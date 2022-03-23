class OpenExrReader {
    constructor(arraybuffer) {
        this.exr_buffer = new Uint8Array(arraybuffer);
        this.read_idx = 0;
        this.scan_lines_per_block = 1;
        this.attributes = {};
        this.offset_table = [];
        
        this.decode();
    }
    
    decode() {
        // magic number and version field
        let magic_num = (this.exr_buffer[3] << 24 | this.exr_buffer[2] << 16 | this.exr_buffer[1] << 8  | this.exr_buffer[0]) >>> 0;
        let version_field = (this.exr_buffer[7] << 24 | this.exr_buffer[6] << 16 | this.exr_buffer[5] << 8  | this.exr_buffer[4]) >>> 0;
        let version = version_field & 0xFF;
        let single_part_tiled = version_field & 0x200;
        let long_names = version_field & 0x400;
        let deep_data = version_field & 0x800;
        let multipart = version_field & 0x1000;
        if (single_part_tiled || long_names || deep_data || multipart) {
            console.log('Error: OpenExrReader only supports single-part scan line EXR images');
            return;
        }
        // attributes
        this.read_idx = 8;
        while (this.exr_buffer[this.read_idx] !== 0) {
            this.readAttrib();
        }
        this.read_idx++;
        // scan line offsets
        let i = 0;
        let num_scan_lines = (this.attributes.dataWindow.value[3] - this.attributes.dataWindow.value[1] + 1) / this.scan_lines_per_block;
        for (i = 0; i < num_scan_lines; i++) {
            this.offset_table.push(this.readInt64());
        }
        // pixel data
        this.read_idx = this.offset_table[0];
        let first_line = this.readInt();
        let first_size = this.readInt();
        let pixel_data = null;
        if (this.attributes.compression.value === 'none') {
            console.log(new Uint8Array(this.exr_buffer.buffer.slice(this.read_idx, this.read_idx + first_size)));
            pixel_data = new Float32Array(this.exr_buffer.buffer.slice(this.read_idx, this.read_idx + first_size));
        }
        else if (this.attributes.compression.value === 'zip') {
            // deflate
            let deflated = pako.inflate(this.exr_buffer.buffer.slice(this.read_idx, this.read_idx + first_size));
            console.log(deflated);
            // reconstruct
            for (i = 1; i < deflated.length; i++) {
                let d = deflated[i-1] + deflated[i] - 128;
                deflated[i] = d;
            }
            // interleave
            let half = deflated.length / 2;
            let uncompressed = new Uint8Array(deflated.length);
            for (i = 0; i < half; i++) {
                uncompressed[2 * i] = deflated[i];
                uncompressed[2 * i + 1] = deflated[half + i];
            }
            console.log(uncompressed);
            pixel_data = new Float32Array(uncompressed.buffer);
        }
        console.log(pixel_data);
    }
    
    readAttrib() {
        let attrib = {};
        let name = '';
        while (this.exr_buffer[this.read_idx] !== 0) {
            name += String.fromCharCode(this.exr_buffer[this.read_idx]);
            this.read_idx++;
        }
        this.read_idx++;
        attrib.type = '';
        while (this.exr_buffer[this.read_idx] !== 0) {
            attrib.type += String.fromCharCode(this.exr_buffer[this.read_idx]);
            this.read_idx++;
        }
        this.read_idx++;
        attrib.size = this.readInt();
        
        if (attrib.type === 'int') {
            attrib.value = this.readInt();
        }
        else if (attrib.type === 'float') {
            attrib.value = this.readFloat();
        }
        else if (attrib.type === 'string') {
            attrib.value = this.readString(attrib.size);
        }
        else if (attrib.type === 'compression') {
            attrib.value = this.readCompression();
        }
        else if (attrib.type === 'lineOrder') {
            attrib.value = this.readLineOrder();
        }
        else if (attrib.type === 'v2i') {
            attrib.value = this.readV2i();
        }
        else if (attrib.type === 'v2f') {
            attrib.value = this.readV2f();
        }
        else if (attrib.type === 'v3i') {
            attrib.value = this.readV3i();
        }
        else if (attrib.type === 'v3f') {
            attrib.value = this.readV3f();
        }
        else if (attrib.type === 'box2i') {
            attrib.value = this.readBox2i();
        }
        else if (attrib.type === 'box2f') {
            attrib.value = this.readBox2f();
        }
        else if (attrib.type === 'chlist') {
            attrib.value = this.readChannelList(attrib.size);
        }
        this.attributes[name] = attrib;
    }
    
    readInt() {
        let int_val = (this.exr_buffer[this.read_idx+3] << 24 |
                       this.exr_buffer[this.read_idx+2] << 16 |
                       this.exr_buffer[this.read_idx+1] <<  8 |
                       this.exr_buffer[this.read_idx]) >>> 0;
        this.read_idx += 4;
        return int_val;
    }
    
    readInt64() {
        // Note: due to limitations of JS, this only uses 48 bits
        let int_val = (this.exr_buffer[this.read_idx+5] << 40 |
                       this.exr_buffer[this.read_idx+4] << 32 |
                       this.exr_buffer[this.read_idx+3] << 24 |
                       this.exr_buffer[this.read_idx+2] << 16 |
                       this.exr_buffer[this.read_idx+1] <<  8 |
                       this.exr_buffer[this.read_idx]) >>> 0;
        this.read_idx += 8;
        return int_val;
    }
    
    readFloat() {
        let float_val = new Float32Array(this.exr_buffer.buffer.slice(this.read_idx, this.read_idx + 4));
        this.read_idx += 4;
        return float_val[0];
    }
    
    readString(length) {
        let i;
        let str = '';
        for (i = 0; i < length; i++) {
            str += String.fromCharCode(this.exr_buffer[this.read_idx + i]);
        }
        this.read_idx += length;
        return str;
    }
    
    readCompression() {
        let compression = '';
        switch (this.exr_buffer[this.read_idx]) {
            case 0:
                compression = 'none';
                this.scan_lines_per_block = 1;
                break;
            case 1:
                compression = 'rle';
                this.scan_lines_per_block = 1;
                break;
            case 2:
                compression = 'zips';
                this.scan_lines_per_block = 1;
                break;
            case 3:
                compression = 'zip';
                this.scan_lines_per_block = 16;
                break;
            case 4:
                compression = 'piz';
                this.scan_lines_per_block = 32;
                break;
            case 5:
                compression = 'pxr24';
                this.scan_lines_per_block = 16;
                break;
            case 6:
                compression = 'b44';
                this.scan_lines_per_block = 32;
                break;
            case 7:
                compression = 'b44a';
                this.scan_lines_per_block = 32;
                break;
        }
        this.read_idx++;
        return compression;
    }
    
    readLineOrder() {
        let line_order = '';
        switch (this.exr_buffer[this.read_idx]) {
            case 0:
                line_order = 'increasing_y';
                break;
            case 1:
                line_order = 'decreasing_y';
                break;
            case 2:
                line_order = 'random_y';
                break;
        }
        this.read_idx++;
        return line_order;
    }
    
    readV2i() {
        let vec = [];
        vec.push((this.exr_buffer[this.read_idx+3] << 24 |
                  this.exr_buffer[this.read_idx+2] << 16 |
                  this.exr_buffer[this.read_idx+1] <<  8 |
                  this.exr_buffer[this.read_idx]) >>> 0);
        vec.push((this.exr_buffer[this.read_idx+7] << 24 |
                  this.exr_buffer[this.read_idx+6] << 16 |
                  this.exr_buffer[this.read_idx+5] <<  8 |
                  this.exr_buffer[this.read_idx+4]) >>> 0);
        this.read_idx += 8;
        return vec;
    }
    
    readV2f() {
        let float_vals = new Float32Array(this.exr_buffer.buffer.slice(this.read_idx, this.read_idx + 8));
        this.read_idx += 8;
        return [float_vals[0], float_vals[1]];
    }
    
    readV3i() {
        let vec = [];
        vec.push((this.exr_buffer[this.read_idx+3] << 24 |
                  this.exr_buffer[this.read_idx+2] << 16 |
                  this.exr_buffer[this.read_idx+1] <<  8 |
                  this.exr_buffer[this.read_idx]) >>> 0);
        vec.push((this.exr_buffer[this.read_idx+7] << 24 |
                  this.exr_buffer[this.read_idx+6] << 16 |
                  this.exr_buffer[this.read_idx+5] <<  8 |
                  this.exr_buffer[this.read_idx+4]) >>> 0);
        vec.push((this.exr_buffer[this.read_idx+11] << 24 |
                  this.exr_buffer[this.read_idx+10] << 16 |
                  this.exr_buffer[this.read_idx+ 9] <<  8 |
                  this.exr_buffer[this.read_idx+ 8]) >>> 0);
        this.read_idx += 12;
        return vec;
    }
    
    readV3f() {
        let float_vals = new Float32Array(this.exr_buffer.buffer.slice(this.read_idx, this.read_idx + 12));
        this.read_idx += 12;
        return [float_vals[0], float_vals[1], float_vals[2]];
    }
    
    readBox2i() {
        let box = [];
        box.push((this.exr_buffer[this.read_idx+3] << 24 |
                  this.exr_buffer[this.read_idx+2] << 16 |
                  this.exr_buffer[this.read_idx+1] <<  8 |
                  this.exr_buffer[this.read_idx]) >>> 0);
        box.push((this.exr_buffer[this.read_idx+7] << 24 |
                  this.exr_buffer[this.read_idx+6] << 16 |
                  this.exr_buffer[this.read_idx+5] <<  8 |
                  this.exr_buffer[this.read_idx+4]) >>> 0);
        box.push((this.exr_buffer[this.read_idx+11] << 24 |
                  this.exr_buffer[this.read_idx+10] << 16 |
                  this.exr_buffer[this.read_idx+ 9] <<  8 |
                  this.exr_buffer[this.read_idx+ 8]) >>> 0);
        box.push((this.exr_buffer[this.read_idx+15] << 24 |
                  this.exr_buffer[this.read_idx+14] << 16 |
                  this.exr_buffer[this.read_idx+13] <<  8 |
                  this.exr_buffer[this.read_idx+12]) >>> 0);
        this.read_idx += 16;
        return box;
    }
    
    readBox2f() {
        let float_vals = new Float32Array(this.exr_buffer.buffer.slice(this.read_idx, this.read_idx + 16));
        this.read_idx += 16;
        return [float_vals[0], float_vals[1], float_vals[2], float_vals[3]];
    }
    
    readChannelList(length) {
        let channels = [];
        let i = 0;
        while (i < length - 1) {
            let channel = {};
            i += this.readChannel(channel);
            channels.push(channel);
        }
        this.read_idx++;
        return channels;
    }
    
    readChannel(channel) {
        let channel_start = this.read_idx;
        channel.name = '';
        while (this.exr_buffer[this.read_idx] !== 0) {
            channel.name += String.fromCharCode(this.exr_buffer[this.read_idx]);
            this.read_idx++;
        }
        this.read_idx++;
        let px_type = this.readInt();
        switch (px_type) {
            case 0:
                channel.pixel_type = 'uint';
                break;
            case 1:
                channel.pixel_type = 'half';
                break;
            case 2:
                channel.pixel_type = 'float';
                break;
        }
        channel.linear = (this.exr_buffer[this.read_idx] === 1);
        this.read_idx += 4;
        channel.sampling_x = this.readInt();
        channel.sampling_y = this.readInt();
        
        return this.read_idx - channel_start;
    }
}
