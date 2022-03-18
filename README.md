# Depth Augmented Stereo Panorama (DASP) WebXR Viewer

A virtual reality viewing application for DASP images (as described in [[1](https://doi.org/10.1109/ICME.2016.7552858)]) implemented using WebGL and WebXR. A few minor tweaks have been made to that technique:

* DASP images should be rendered using an infinite convergence distance (i.e. parallel spherical projection)
* No shrinking viewing radius with elevation angle (i.e. no pole merging)

#### Rendering DASP Images in [Blender](https://www.blender.org/)

* Render Properties
    * Render Engine: Cycles
    * Device: GPU Compute *(optional)*
        * May also want to select type of Cycles render device (e.g. OptiX vs. CUDA)
        * Edit --> Preferences, select Systems tab, select desired option under Cycles Render Devices
* Output Properties
    * Format
        * Ensure Resolution X and Y have a 2:1 ratio (e.g. 3840 px and 1920 px)
    * Check Stereoscopy
    * Views
        * Views Format: Stereo 3D
        * Stereo Mode: Top Bottom
* Object Data Properties (with camera selected)
    * Lens
        * Type: Panoramic
        * Panorama Type: Equirectangular
    * Stereoscopy
        * Mode: Parallel
        * Interoculuar Distance: enter desired IPD + desired head motion diameter (e.g. for an IPD of 0.065 m and head motion diameter of 0.25 m, enter 0.315 m)
        * Check Spherical Stereo

#### References

[1] J. Thatte, J. Boin, H. Lakshman and B. Girod, "Depth augmented stereo panorama for cinematic virtual reality with head-motion parallax," *2016 IEEE International Conference on Multimedia and Expo (ICME)*, 2016, pp. 1-6, doi: [10.1109/ICME.2016.7552858](https://doi.org/10.1109/ICME.2016.7552858).
