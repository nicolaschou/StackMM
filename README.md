# StackMM Photoshop Script
**Latest Version: v1.1 (08/17/2025)**

## What the Script Does
- Imports images as layers into a single Photoshop document.  
- Orders the layers as follows (from top to bottom):
  1. Masks  
  2. MMs  
  3. pMaps  
  4. Average images  
- Within each category, second acquisition layers appear above first acquisition layers.  
- Groups all pMaps and links layers from the same acquisition.  
- Deletes all black pixels from the mask layers (the parts of the MMs that should not be masked), then inverts the masks.  
- Flips the document vertically to match Igor’s display.  

## Installation
1. Move the `StackMM.jsx` file into Photoshop’s Scripts folder: **Applications → Adobe Photoshop 2025 → Presets → Scripts**
2. Restart Photoshop if it’s already open.

## Usage
1. In Photoshop, go to **File → Scripts → StackMM**.  
2. When prompted, select image files from the **first acquisition** and click **Done**.  
3. Repeat the process for the **second acquisition**.  
    - The file dialog will indicate which acquisition is being loaded.  
4. Wait for all layers to load.  
5. **Manually align the two acquisitions** (layers are already linked by acquisition).  
6. Save the project as a `.psd` file with appropriate naming conventions.  

## Notes
- The script only works for datasets with **two acquisitions**.  
- Masks ***must contain “mask”*** in their file name (case insensitive)
- pMaps ***must contain “pmap”*** in their file name (case insensitive)
- Average images ***must contain “average”*** in their file name (case insensitive)
- Files that ***do not contain “mask”, “pmap”, or “average”*** in their name are treated as MMs
- The two acquisitions ***must be aligned manually*** after the script is run (layers are already linked by acquisition)

## Version History
- **v1.1** (8/17/2025)  
    - Added ability to select files in multiple batches for each acquisition.


