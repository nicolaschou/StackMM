/**
 * ========================================
 * File:        StackMM.jsx
 * Description: This script automatically sorts and loads Igor images from
 *              Igor into a Photoshop document
 * Author:      Nico Chou
 * ========================================
 */

// Ensure Photoshop is the active app
#target photoshop

// Set units to pixels
app.preferences.rulerUnits = Units.PIXELS;

// Object to track the properties of an image in the stack
function ImageObject(file, isFirstAcquisition) {
    this.file = file; // stores the File object for this image
    this.layer = null // stores the Photoshop layer object for this image

    // Booleans that indicate the type of image
    this.isFirstAcquisition = isFirstAcquisition;
    this.ispMap = (file.name.toLowerCase().indexOf("pmap") !== -1);
    this.isMask = (file.name.toLowerCase().indexOf("mask") !== -1);
    this.isAverage = (file.name.toLowerCase().indexOf("average") !== -1);
    this.isMM = !this.ispMap && !this.isMask && !this.isAverage;
}

// Create an empty array to hold the selected files as File objects
var images = [];

// Function that collects files for a given acquisition
function collectImages(isFirst) {
    // Create a file opening window
    var acquisitionLabel = isFirst ? "FIRST" : "SECOND";
    var promptText = "Select images from the " + acquisitionLabel + 
                     " acquisition";
    var dlg = new Window("dialog", promptText)
    dlg.alignChildren = ["fill", "top"];

    // File list
    var fileListBox = dlg.add("listbox", [0, 0, 400, 200], [], {
        multiselect: false
    });

    // Row of buttons
    var buttonGroup = dlg.add("group");
    buttonGroup.orientation = "row";

    // Add files button
    var addButton = buttonGroup.add("button", undefined, "Add Files");
    // When clicked, this button adds prompts the user to open files
    addButton.onClick = function () {
        var files = File.openDialog(promptText, "Images:*.jpg;*.png;*.tif", 
                                    true);

        // Store imageObjects in the images array, and update the fileListBox
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
}

collectImages(true);
collectImages(false);

// Separate images for reordering
var masks = [];
var MMs = [];
var pMaps = [];
var averages = [];
for (var i = 0; i < images.length; i++) {
    if (images[i].isMask) {
        masks.push(images[i])
    } else if (images[i].ispMap) {
        pMaps.push(images[i])
    } else if (images[i].isAverage) {
        averages.push(images[i])
    } else if (images[i].isMM) {
        MMs.push(images[i])
    }
}

// Sort function that puts the first acquisiton above the second
function acquisitionSort(a, b) {
    // Sort alphabetically if from the same acquisition
    if (a.isFirstAcquisition === b.isFirstAcquisition) {
        return a.file.name.localeCompare(b.file.name);
    }
    return a.isFirstAcquisition ? -1 : 1;
}

masks.sort(acquisitionSort);
MMs.sort(acquisitionSort);
pMaps.sort(acquisitionSort);
averages.sort(acquisitionSort);

// Re-order images as follows: average images, pMaps, MMs, masks (with the 
// first acquisition above first). **THIS ORDER IS INVERTED IN PHOTOSHOP**
images = averages.concat(pMaps, MMs, masks);

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

var bottomMM = null

// Loop over files and add each as a layer
for (var i = 1; i < images.length; i++) {
    var tempDoc = app.open(images[i].file); // Open image temporarily
    tempDoc.activeLayer.name = images[i].file.name; // rename layer
    tempDoc.activeLayer.duplicate(doc); // Duplicate image into main document
    images[i].layer = doc.activeLayer; // Store layer in ImageObject
    if (images[i].isMM && bottomMM === null) {
        bottomMM = doc.activeLayer; // Store the layer containing the first MM
    }
    tempDoc.close(SaveOptions.DONOTSAVECHANGES); // Close temp doc
}

// Group all pMap layers
var pMapsGroup = doc.layerSets.add();
pMapsGroup.move(bottomMM, ElementPlacement.PLACEAFTER); // Move below the MMs
pMapsGroup.name = "pMaps";
for (var i = 0; i < pMaps.length; i++) {
    pMaps[i].layer.move(pMapsGroup, ElementPlacement.INSIDE);
}

var firstAcquisitionLayer1 = null
var secondAcquisitionLayer1 = null

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

// Function that selects all visible black pixels
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

// Function that deletes all black pixels from a given layer
function deleteBlackPixelsFromLayer(layer) {
    doc.activeLayer = layer;

    // Hide other layers to avoid deleting unwanted pixels
    for (var i = 0; i < doc.layers.length; i++) {
        if (doc.layers[i] !== layer) {
            doc.layers[i].visible = false;
        }
    }
    
    selectBlackColorRange();
    doc.selection.clear(); // Remove black pixels
    doc.selection.deselect(); // Deselect
    
    // Restore original visibility of all layers
    for (var i = 0; i < doc.layers.length; i++) {
        doc.layers[i].visible = true;
    }
}

// Delete black part of masks and invert
for (var i = 0; i < masks.length; i++) {
    deleteBlackPixelsFromLayer(masks[i].layer);
    masks[i].layer.invert();
}

// Flip canvas
doc.flipCanvas(Direction.VERTICAL);