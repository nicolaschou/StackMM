/**
 * ========================================
 * File:        StackMM.jsx
 * Description: Script to load and organize Igor images generated with the 
 *              Gilbert Group Macros in Photoshop, sorting by acquisition and 
 *              type with automated mask cleanup.
 * Author:      Nico Chou
 * ========================================
 */


// Ensure Photoshop is the active app
#target photoshop


/**
 * Main entry point. Collects images, reorders them, configures document, adds 
 * layers, groups pMaps, links acquisitions, edits masks, and flips canvas.
 */
(function main() {
    // Set units to pixels
    app.preferences.rulerUnits = Units.PIXELS;

    var first = collectImages(true);
    var second = collectImages(false);
    var images = first.concat(second);
    var parts = reorderImages(images);
    images = parts.ordered;
    var masks = parts.masks;
    var MMs = parts.MMs;
    var pMaps = parts.pMaps;
    var averages = parts.averages;
    var doc = configureDoc(images);
    addLayers(doc, images);
    groupPMaps(doc, images, pMaps);
    linkAcquisitions(images);
    editMasks(doc, masks);

    // Flip canvas
    doc.flipCanvas(Direction.VERTICAL);
})();


/**
 * Represents an image in the Photoshop stack.
 * 
 * @constructor
 * @param {File} file - The file object for this image.
 * @param {boolean} isFirstAcquisition - True if the image is from the first 
 *                                       acquisition.
 */
function ImageObject(file, isFirstAcquisition) {
    this.file = file; // stores the File object for this image
    this.layer = null; // stores the Photoshop layer object for this image
    var name = file.name.toLowerCase();

    // Booleans that indicate the type of image
    this.isFirstAcquisition = isFirstAcquisition;
    this.isPMap = (name.indexOf("pmap") !== -1);
    this.isMask = (name.indexOf("mask") !== -1);
    this.isAverage = (name.indexOf("average") !== -1);
    this.isMM = !this.isPMap && !this.isMask && !this.isAverage;
}


/**
 * Opens a dialog to collect image files for a given acquisition.
 * 
 * @param {boolean} isFirst - True if collecting for the first acquisition.
 * @returns {ImageObject[]} Array of selected images as ImageObjects.
 */
function collectImages(isFirst) {
    // Create a file opening window
    var acquisitionLabel = isFirst ? "FIRST" : "SECOND";
    var promptText = "Select images from the " + acquisitionLabel + 
                     " acquisition";
    var dlg = new Window("dialog", promptText);
    dlg.alignChildren = ["fill", "top"];

    // File list and button row
    var fileListBox = dlg.add("listbox", [0, 0, 400, 200], [], {
        multiselect: false
    });
    var buttonGroup = dlg.add("group");
    buttonGroup.orientation = "row";

    // Empty array to hold the selected images as ImageObjects
    var images = [];

    // Add files button
    var addButton = buttonGroup.add("button", undefined, "Add Files");
    addButton.onClick = function () {
        var files = File.openDialog(
            promptText,
            "Images:*.jpg;*.jpeg;*.png;*.tif;*.tiff;" +
            "*.JPG;*.JPEG;*.PNG;*.TIF;*.TIFF",
            true
        );
        // Store imageObjects and update the fileListBox
        if (files != null) {
            for (var i = 0; i < files.length; i++) {
                var imageObject = new ImageObject(files[i], isFirst);
                images.push(imageObject);
                fileListBox.add("item", files[i].name);
            }
        } 
    };
    
    // Done button
    var doneButton = buttonGroup.add("button", undefined, "Done", 
                                     { name: "ok" });
    doneButton.onClick = function () {
        dlg.close();
    };

    dlg.show();
    return images;
}


/**
 * Reorders images into categories (masks, MMs, pMaps, averages). Within each
 * category, images are sorted by acquisition (the first before the second).
 * 
 * @param {ImageObject[]} images - The list of ImageObjects.
 * @returns {{
 *   ordered: ImageObject[],
 *   masks: ImageObject[],
 *   MMs: ImageObject[],
 *   pMaps: ImageObject[],
 *   averages: ImageObject[]
 * }} Arrays of ImageObjects sorted by category
 */
function reorderImages(images) {
    // Separate images for reordering
    var masks = [], MMs = [], pMaps = [], averages = [];
    for (var i = 0; i < images.length; i++) {
        var im = images[i];
        if (im.isMask) masks.push(im);
        else if (im.isPMap) pMaps.push(im);
        else if (im.isAverage) averages.push(im);
        else if (im.isMM) MMs.push(im);
    }
    
    // Sort function that puts the first acquisition before the second
    var acquisitionSort = function(a, b) {
        // Sort alphabetically if from the same acquisition
        if (a.isFirstAcquisition === b.isFirstAcquisition) {
            return a.file.name.localeCompare(b.file.name);
        }
        return a.isFirstAcquisition ? -1 : 1;
    };

    masks.sort(acquisitionSort);
    MMs.sort(acquisitionSort);
    pMaps.sort(acquisitionSort);
    averages.sort(acquisitionSort);

    // Re-order images as: averages, pMaps, MMs, masks.
    // Note: Photoshop displays this order inverted in the Layers panel.
    var ordered = averages.concat(pMaps, MMs, masks);

    return {
        ordered: ordered,
        masks: masks,
        MMs: MMs,
        pMaps: pMaps,
        averages: averages
    };
}


/**
 * Configures a new Photoshop document to match the images. Ensures RGB color 
 * mode and 8-bit depth.
 * 
 * @param {ImageObject[]} images
 * @returns {Document} The new Photoshop document.
 */
function configureDoc(images) {
    // Create a new document that matches the dimensions of the images
    var doc = app.open(images[0].file);
    doc.activeLayer.name = images[0].file.name;
    images[0].layer = doc.activeLayer;

    // Change color mode to RGB
    if (doc.mode != DocumentMode.RGB) {
        doc.changeMode(ChangeMode.RGB);
    }

    // Change bit depth to 8
    if (doc.bitsPerChannel != BitsPerChannelType.EIGHT) {
        doc.bitsPerChannel = BitsPerChannelType.EIGHT;
    }

    return doc;
}


/**
 * Adds each image as a layer to a document.
 * 
 * @param {Document} doc - The target document.
 * @param {ImageObject[]} images - Array of ImageObjects.
 */
function addLayers(doc, images) {
    // Loop over files and add each as a layer
    for (var i = 1; i < images.length; i++) {
        var tempDoc = app.open(images[i].file); // Open image temporarily
        tempDoc.activeLayer.name = images[i].file.name; // rename layer
        tempDoc.activeLayer.duplicate(doc); // Copy image into the document
        images[i].layer = doc.activeLayer; // Store layer in ImageObject
        tempDoc.close(SaveOptions.DONOTSAVECHANGES); // Close temp doc
    }
}


/**
 * Groups pMap layers and places them after the bottom MM layer.
 * 
 * @param {Document} doc - The Photoshop document.
 * @param {ImageObject[]} images - All ImageObjects.
 * @param {ImageObject[]} pMaps - Array of pMap ImageObjects.
 * @returns {LayerSet} The created pMaps group.
 */
function groupPMaps(doc, images, pMaps) {
    // Find the bottom MM layer to place pMaps after
    var bottomMM = null;
    for (var i = 0; i < images.length; i++) {
        if (images[i].isMM) {
            bottomMM = images[i].layer;
            break;
        }
    }

    // Group pMaps
    var pMapsGroup = doc.layerSets.add();
    pMapsGroup.name = "pMaps";
    for (var i = 0; i < pMaps.length; i++) {
        pMaps[i].layer.move(pMapsGroup, ElementPlacement.INSIDE);
    }

    // Move below the MMs
    pMapsGroup.move(bottomMM, ElementPlacement.PLACEAFTER);

    return pMapsGroup;
}


/**
 * Links layers belonging to the same acquisition.
 * 
 * @param {ImageObject[]} images - The array of ImageObjects.
 */
function linkAcquisitions(images) {
    var firstAcquisitionLayer1 = null;
    var secondAcquisitionLayer1 = null;

    // Link layers from the same acquisition
    for (var i = 0; i < images.length; i++) {
        if (images[i].isFirstAcquisition) {
            if (firstAcquisitionLayer1 === null) {
                firstAcquisitionLayer1 = images[i].layer;
            } else {
                firstAcquisitionLayer1.link(images[i].layer);
            }
        } else {
            if (secondAcquisitionLayer1 === null) {
                secondAcquisitionLayer1 = images[i].layer;
            } else {
                secondAcquisitionLayer1.link(images[i].layer);
            }
        }
    }
}


/**
 * Selects all visible black pixels in the active document.
 */
function selectBlackColorRange() {
    // Main descriptor
    var desc = new ActionDescriptor();
    desc.putInteger(charIDToTypeID("Fzns"), 0); // fuzziness = 0

    // Color descriptor
    var blackColor = new ActionDescriptor();
    blackColor.putDouble(charIDToTypeID("Rd  "), 0);
    blackColor.putDouble(charIDToTypeID("Grn "), 0);
    blackColor.putDouble(charIDToTypeID("Bl  "), 0);

    // Add the color descriptor to the main descriptor
    desc.putObject(charIDToTypeID("Mnm "), charIDToTypeID("RGBC"), blackColor);
    desc.putObject(charIDToTypeID("Mxm "), charIDToTypeID("RGBC"), blackColor);

    executeAction(charIDToTypeID("ClrR"), desc, DialogModes.NO);
}


/**
 * Deletes all black pixels from a given layer.
 * 
 * @param {Document} doc - The Photoshop document.
 * @param {ArtLayer} layer - The layer to edit.
 */
function deleteBlackPixelsFromLayer(doc, layer) {
    doc.activeLayer = layer;
    doc.activeLayer.visible = true;

    // Hide other layers to avoid altering unwanted pixels
    for (var i = 0; i < doc.layers.length; i++) {
        if (doc.layers[i] !== layer) {
            doc.layers[i].visible = false;
        }
    }
    
    // Select and delete all black pixels
    selectBlackColorRange();
    doc.selection.clear();
    doc.selection.deselect();
    
    // Restore visibility of all layers
    for (var i = 0; i < doc.layers.length; i++) {
        doc.layers[i].visible = true;
    }
}


/**
 * Deletes black pixels and inverts each mask layer in the provided array.
 *
 * @param {Document} doc - The Photoshop document.
 * @param {ImageObject[]} masks - Array of mask ImageObjects.
 */
function editMasks(doc, masks) {
    for (var i = 0; i < masks.length; i++) {
        deleteBlackPixelsFromLayer(doc, masks[i].layer);
        masks[i].layer.invert();
    }
}