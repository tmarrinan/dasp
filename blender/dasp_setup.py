import bpy
import math

def main():
    device_type = 'OPTIX'
    device_number = 0
    resolution_x = 2048
    resolution_y = 1024
    ipd = 0.065
    parallax_diameter = 0.25
    camera_center = (0.0, 0.0, 1.6)
    camera_right_vec = createCameraVector([1.0, 0.5, 1.0], ipd, parallax_diameter)
    
    # remove default objects
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    
    # change render engine to 'Cycles'
    bpy.context.scene.render.engine = 'CYCLES'
    bpy.context.scene.cycles.device = 'GPU'
    bpy.context.scene.cycles.preview_samples = 64
    bpy.context.scene.cycles.samples = 256
    cycles_prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        cycles_prefs.compute_device_type = device_type
    except TypeError:
        print(f'APP> Error: render device type \'{device_type}\' not available')
        exit(1)
    cycles_prefs.get_devices()
    selectRenderDevice(cycles_prefs, device_type, device_number)
    
    # add 2 pano cameras
    cam1 = createPanoCamera('CameraL')
    cam1.location = (camera_center[0] - camera_right_vec[0], camera_center[1] - camera_right_vec[1], camera_center[2] - camera_right_vec[2])
    cam1.rotation_euler = (math.pi / 2, 0.0, 0.0)
    bpy.context.collection.objects.link(cam1)
    
    cam2 = createPanoCamera('CameraR')
    cam2.location = (camera_center[0] + camera_right_vec[0], camera_center[1] + camera_right_vec[1], camera_center[2] + camera_right_vec[2])
    cam2.rotation_euler = (math.pi / 2, 0.0, 0.0)
    bpy.context.collection.objects.link(cam2)
    
    bpy.context.scene.camera = cam1
    
    # enable multiview to render both cameras
    bpy.context.scene.render.use_multiview = True
    bpy.context.scene.render.views_format = 'MULTIVIEW'
    # TODO:
    #  - uncheck 'left' and 'right' views
    #  - add two new views (make sure 'Camera Suffix' equals the suffix of each camera's name (e.g. CameraL would have suffix L))
    
    """
    # add camera
    cam_data = bpy.data.cameras.new('Camera')
    cam_data.type = 'PANO'
    cam_data.clip_start = 0.305 # 1 ft.
    cam_data.clip_end = 200.0
    cam_data.cycles.panorama_type = 'EQUIRECTANGULAR'
    cam_data.stereo.convergence_mode = 'PARALLEL'
    cam_data.stereo.interocular_distance = 0.065
    cam_data.stereo.use_spherical_stereo = True
    cam = bpy.data.objects.new('Camera', cam_data)
    cam.location = (0.0, 0.0, 1.6)
    cam.rotation_euler = (math.pi / 2, 0.0, 0.0)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    
    # enable stereo
    bpy.context.scene.render.use_multiview = True
    bpy.context.scene.render.resolution_x = resolution_x
    bpy.context.scene.render.resolution_y = resolution_y
    bpy.context.scene.render.image_settings.views_format = 'STEREO_3D'
    bpy.context.scene.render.image_settings.stereo_3d_format.display_mode = 'TOPBOTTOM'
    """
    
def selectRenderDevice(cycles_prefs, device_type, device_number):
    device_count = 0
    device_found = False
    for device in cycles_prefs.devices:
        if device.type == device_type and device_count == device_number:
            device.use = True
            device_found = True
        else:
            device.use = False
        if device.type == device_type:
            device_count += 1
    if not device_found:
        print(f'APP> Error: could not find {device_type} device {device_number}')
        exit(1)
    print(f'APP> Cycles Render Engine using: {device_type} device {device_number}')

def createCameraVector(direction, ipd, parallax_diameter):
    magnitude = math.sqrt(direction[0] ** 2 + direction[1] ** 2 + direction[2] **2)
    length = 0.5 * (ipd + parallax_diameter)
    scale = length / magnitude
    return (scale * direction[0], scale * direction[1], scale * direction[2])

def createPanoCamera(name):
    cam_data = bpy.data.cameras.new(name)
    cam_data.type = 'PANO'
    cam_data.clip_start = 0.25
    cam_data.clip_end = 250.0
    cam_data.cycles.panorama_type = 'EQUIRECTANGULAR'
    cam = bpy.data.objects.new(name, cam_data)
    return cam

main()
