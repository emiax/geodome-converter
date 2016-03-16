var spawn = require('child_process').spawn;

/**
 *  TODO:
 *  - Add support for config file or command line args
 *  - Add possibility to only run png conversion or only ffmpeg
 *  - And so on, there is much left to wish for :)
 */

/////// Configuration ////////////////

var inputBaseName = "F:/rising-seas4/RisingSeas";
var tempBaseName = "temp/RisingSeas";
var videoOutName = "videoOut.mp4";

var startIndex = 900;
var endIndex = 7946;
var nZeros = 4;
var batchSize = 8;

//////////////////////////////////////

/**
 * Return a zero-padded string.
 * for example padZeros(2, 4) returns 0002
 */
function padZeros(n, nZeros) {
    var padder = Math.pow(10, nZeros);
    return ("" + (padder + n)).substr(1);
}

/**
 * Run a png conversion
 */
function runPngConversion(index) {
    return new Promise((resolve, reject) => {
        var inFile = inputBaseName + padZeros(index, nZeros) + ".png";
        var outFile = tempBaseName + padZeros(index, nZeros) + ".png";
        
        var convert = spawn("convert", [inFile,
                                        "-resize", "1400x1050^",
                                        "-gravity", "south",
                                        "-extent", "1400x1050",
                                        outFile]);
        
        convert.stdout.on('data', function (data) {
            console.log(`STDOUT ${data}`);
        });
        
        convert.stderr.on('data', function (data) {
            console.log(`STDERR ${inFile} ${data}`);
        });
        
        convert.on('close', () => {
            resolve();
        });
    });
};

/**
 * Run all PNG conversions (resize & crop)
 */
function runAllPngConversions() {
    return new Promise((resolve, reject) => {
        var nextIndex = startIndex;
        function startWorker() {
            return new Promise((resolveWorker, rejectWorker) => {
                (function nextImage() {
                    var myIndex = nextIndex++;
                    var percentage = ((myIndex - startIndex) / (endIndex - startIndex + 1) * 100);
                    
                    process.stdout.clearLine();
                    process.stdout.cursorTo(0);
                    process.stdout.write("Converting image " + myIndex +
                                         "... (" + percentage + "%)");
                    
                    if (myIndex > endIndex) {
                        resolveWorker();
                    } else {
                        runPngConversion(myIndex).then(nextImage);
                    }
                })();
            });
        }
        var promises = [];
        for (var i = startIndex; i < startIndex + batchSize; i++) {
            promises.push(startWorker(i));
        }
        Promise.all(promises).then(resolve);
    });
}

/**
 * Run FFMPEG for the whole sequence
 */
var runFfmpeg = function () {
    return new Promise((resolve, reject) => {
        var ffmpeg = spawn("ffmpeg", ["-y",
                                      "-f", "image2", 
                                      "-framerate",
                                      "30",
                                      "-start_number", startIndex,
                                      "-i", tempBaseName + "%04d" + ".png",
                                      "-s:v", "1480x1050",
                                      "-c:v", "libx264",
                                      "-profile:v", "high",
                                      "-crf", "20",
                                      "-pix_fmt", "yuvj420p",
                                      videoOutName]);

        ffmpeg.stdout.on('data', function (data) {
            console.log(`STDOUT ${data}`);
        });
        
        ffmpeg.stderr.on('data', function (data) {
            console.log(`STDERR ${data}`);
        });
        
        ffmpeg.on('close', resolve);
    });
};

/**
 * Fire away!
 */
runAllPngConversions().then(() => {
    runFfmpeg().then(() => {
        console.log("converted png sequence to geodome format");
    }, (reason) => {
        console.log("ffmpeg conversion failed ", reason);
    });
}, (reason) => {
    console.log("png crop/resize operation failed", reason);
});
