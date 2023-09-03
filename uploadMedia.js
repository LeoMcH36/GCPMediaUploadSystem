const multer = require('multer');
const cors = require('cors')
const express = require('express');
const app = express();
app.use(cors())
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);


app.listen(3000, () => {
    console.log('Server listening on port 3000');
});


const { ImageAnnotatorClient } = require('@google-cloud/vision');
const videoIntelligence = require('@google-cloud/video-intelligence');

const clientVideoAI = new videoIntelligence.VideoIntelligenceServiceClient();



const visionAI = new ImageAnnotatorClient({ keyFilename: 'visionAIKey.json' });

// Creates a client
const storageBucket = new Storage({ keyFilename: 'gabipbucketkey.json' });

const bucketName = 'gabip_bucket';

// Reference an existing bucket
const bucket = storageBucket.bucket(bucketName);

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage
});

var responseEnded = false;

const imageFileExtensions = [
    "bmp",
    "gif",
    "jpeg",
    "jpg",
    "png",
    "tiff",
    "svg",
    "pbm",
    "pgm",
    "ppm",
    "xbm",
    "ico",
    "cur",
    "psd",
    "ai",
    "jfif",
    "tga",
    "webp",
    "avif"
];

const videoFilesExtensions = [
    "3g2",
    "3gp",
    "aaf",
    "asf",
    "avchd",
    "avi",
    "drc",
    "flv",
    "m2v",
    "m3u8",
    "m4p",
    "m4v",
    "mkv",
    "mng",
    "mov",
    "mp2",
    "mp4",
    "mpe",
    "mpeg",
    "mpg",
    "mpv",
    "mxf",
    "nsv",
    "ogg",
    "ogv",
    "qt",
    "rm",
    "rmvb",
    "roq",
    "svi",
    "vob",
    "webm",
    "wmv",
    "yuv"
]






app.post('/upload', upload.array('image'), async (req, res) => {

    for (let i = 0; i < req.files.length; i++) {

        var command = ffmpeg();

        let contentType = "";
        responseEnded = false;
        console.log(req.files[i]);
        let fileType = req.files[i].originalname.split(".").pop().toLowerCase();
        console.log("fileType: " + fileType);

        var mediaBuffer = req.files[i].buffer;
        var originalFileName = req.files[i].originalname;

        console.log("Original Name " + originalFileName)

        var file = await checkValidFile(imageFileExtensions, videoFilesExtensions, fileType);

        console.log("Media is a " + file)

        let noConversion = false;

        noConversion = await conversionNeededCheck(fileType)
        console.log(noConversion)
        if (noConversion === false) {
            //var file = await checkValidFile(imageFileExtensions, videoFilesExtensions, fileType);

            console.log("Media is a " + file)

            //if a non webp image
            if (file === "image") {
                fileType = "webp";
                contentType = "image/webp"
                //convert to webp
                try {
                    await writeFileToMemory(mediaBuffer, originalFileName);

                    //vision ai not compatible with many file types so convert first to webp
                    await convertToWebp(originalFileName, command);

                    if (!responseEnded) {
                        let response = await detectExplicitContent(originalFileName);

                        if (response === "Inappropriate image") {
                            await deleteFileFromMemory(originalFileName, fileType, true)
                            res.send({ "result": 'Inappropriate Image' });
                            return;
                        }
                    }
                    else {
                        res.send({ "result": 'Unable to convert to WebP' });
                        return;
                    }

                } catch (err) {
                    console.error('Error converting image to WebP:', err);
                }
            }
            else if (file === "video") {
                fileType = "webm";
                contentType = "video/webm";
                try {
                    await writeFileToMemory(mediaBuffer, originalFileName);

                    //await detectExplicitContentVideo(originalFileName);
                    //await detectExplicitContent(originalFileName);
                    if (!responseEnded) {
                        await convertToWebm(originalFileName, command);
                    }
                    else {
                        res.send({ "result": 'Inappropriate Video' });
                    }
                } catch (err) {
                    console.error('Error converting video to WebM:', err);
                }
            }
            else {
                console.log("Invalid File");
                res.send({ "result": 'Invalid File Type' });
                responseEnded = true;
            }
        } else {
            await writeFileToMemory(mediaBuffer, originalFileName);

            if (file === "image")
            {
            let response = await detectExplicitContent(originalFileName);
            if (response === "Inappropriate image") {
                await deleteFileFromMemory(originalFileName, fileType, false)
                res.send({ "result": 'Inappropriate Image' });
                return;
            }
            }
            
        }



        if (!responseEnded) {


            await uploadToGCP(fileType, originalFileName, contentType);


            if (!noConversion) {
                await deleteFileFromMemory(originalFileName, fileType, true);
            }
            else {
                await deleteFileFromMemory(originalFileName, fileType, false);
            }

            if (!(i + 1 < req.files.length)) {
                res.send({ "result": `ok` });
            }
        }
    }
});




async function conversionNeededCheck(fileType) {
    return new Promise((resolve) => {
        if (fileType === "webp" || fileType === "webm") {
            console.log("No conversion needed")
            resolve(true)
        }
        resolve(false)
    })

}



//functions

async function convertToWebp(originalFileName, command) {

    console.log("converting image to webp");

    return new Promise((resolve, reject) => {
        try {


            if (fs.existsSync(`./media/${originalFileName}`)) {
                console.log(`./media/${originalFileName} exists`);
            } else {
                console.log('File does not exist');
            }

            console.log(`converting ./media/${originalFileName} to ./media/${originalFileName.split(".")[0]}.webp`)
            command.input(`./media/${originalFileName}`);
            command.output(`./media/${originalFileName.split(".")[0]}.webp`);
            command.format('webp');
            command
                .on('start', function (commandLine) {
                    console.log('Command: ' + commandLine);
                })
                .on('progress', function () {
                    console.log('Converting...');
                })
                .on('end', async function () {
                    console.log('Conversion complete');
                    console.log('Image converted to WebP successfully!');
                    await deleteFileFromMemory(originalFileName, "", false)
                    resolve('Process finished');
                })
                .on('error', function (err) {
                    console.log('An error occurred: ' + err.message);

                    responseEnded = true;
                })
                .run();
        }
        catch (err) {
            console.log(err);
            responseEnded = true;
            reject("Process Failed");


        }
        //resolve('Process finished');
    }
    );
}

async function convertToWebm(originalFileName, command) {

    console.log("converting video to webm");

    return new Promise((resolve) => {
        try {

            if (fs.existsSync(`./media/${originalFileName}`)) {
                console.log(`./media/${originalFileName} exists`);
            } else {
                console.log('File does not exist');
            }
            console.log(`converting  ./media/${originalFileName} to ./media/${originalFileName.split(".")[0]}.webm`)
            command.input(`./media/${originalFileName}`);
            command.output(`./media/${originalFileName.split(".")[0]}.webm`);
            command.format('webm');

            command
                .on('start', function (commandLine) {
                    console.log('Command: ' + commandLine);
                })
                .on('progress', function () {
                    console.log('Converting...');
                })
                .on('end', async function () {
                    console.log('Conversion complete');
                    console.log('Video converted to WebM successfully!');
                    await deleteFileFromMemory(originalFileName, "", false)
                    resolve('Process finished');

                })
                .on('error', function (err) {
                    console.log('An error occurred: ' + err.message);

                    responseEnded = true;
                })
                .run();
        }
        catch (err) {
            console.log(err);
            responseEnded = true;
            resolve("Process Failed");


        }

    });



}



async function uploadToGCP(fileType, originalFileName, contentType) {
    console.log("Uploading to GCP...")

    return new Promise((resolve) => {

        bucket.upload(`./media/${originalFileName.split(".")[0]}.${fileType}`, {
            // Support for HTTP requests made with `Accept-Encoding: gzip`
            gzip: true,
            // By setting the option `destination`, you can change the name of the
            // object you are uploading to a bucket.
            destination: `${originalFileName.split(".")[0]}.${fileType}`,
            metadata: {
                // Enable long-lived HTTP caching headers
                // Use only if the contents of the file will never change
                // (If the contents will change, use cacheControl: 'no-cache')
                contentType: contentType,
                cacheControl: 'public, max-age=31536000',
            },
        }, (err, file) => {
            if (err) {
                console.error(err);
                resolve("Failed to upload to gcp");

                responseEnded = true;
                return;
            }
            console.log(`./media/${originalFileName.split(".")[0]}.${fileType} uploaded to ${file.bucket.name}.`);
            resolve("Process Finished")
        });

    }
    );

}


async function checkValidFile(imageFileExtensions, videoFilesExtensions, fileType) {

    console.log("Validating file...")

    return new Promise((resolve) => {


        if (imageFileExtensions.includes(fileType)) {
            resolve("image");
        }
        else if (videoFilesExtensions.includes(fileType)) {
            resolve("video");
        }
        else {
            resolve("invalid");
        }

    }
    );
}


async function writeFileToMemory(mediaBuffer, originalFilename) {
    console.log("writing to memory...")

    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
        try {
            const buffer = Buffer.from(mediaBuffer, "binary");
            await streamFile(originalFilename, buffer);
            //fs.createWriteStream(`./media/${originalFilename}`).write(buffer);
            console.log(`./media/${originalFilename} succesfully written to memory`)
            resolve("process finished")
        }
        catch (err) {
            responseEnded = true;
            resolve("process unsuccessful")


        }

    }
    )
}
async function streamFile(originalFilename, buffer) {
    return new Promise((resolve) => {

        try {
            let writeStream = fs.createWriteStream(`./media/${originalFilename}`);

            writeStream.on('finish', () => {
                resolve('process finished');
            });

            writeStream.on('error', (error) => {
                console.log('An error occurred: ' + error.message);
            });

            writeStream.write(buffer);
            writeStream.end();
        }
        catch (err) {
            console.log(err);
            responseEnded = true;
            resolve("Process Failed");


        }


    }
    )
}
async function deleteFileFromMemory(originalFileName, fileType, converted) {
    console.log("Deleting file...")


    if (converted) {

        return new Promise((resolve) => {
            fs.unlink(`./media/${originalFileName.split(".")[0]}.${fileType}`, (err) => {
                if (err) {

                    responseEnded = true;
                    resolve("couldn't delete converted file")
                    throw err;
                }
                console.log(`./media/${originalFileName.split(".")[0]}.${fileType} was deleted`);//or else the file will be deleted

                resolve("Process Finished")
            });
        }
        );
    }
    else {

        return new Promise((resolve) => {
            fs.unlink(`./media/${originalFileName}`, (err) => {
                if (err) {

                    responseEnded = true;
                    resolve("couldn't delete original file")
                    throw err;
                }
                console.log(`./media/${originalFileName} was deleted`);//or else the file will be deleted

                resolve("Process Finished")
            });
        }
        )
    }
}





// Detects explicit content in the image
async function detectExplicitContent(originalFileName) {
    console.log("detecting inappropriate imagery...")

    let detectionValues = ["LIKELY", "VERY_LIKELY"];

    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        try {
            const [result] = await visionAI.safeSearchDetection(`./media/${originalFileName.split(".")[0]}.webp`);
            console.log(result)
            const detections = result.safeSearchAnnotation;
            console.log(detections)
            if (detectionValues.includes(detections.adult)
                || detectionValues.includes(detections.medical) || detectionValues.includes(detections.violence) ||
                detectionValues.includes(detections.racy)) {
                responseEnded = true;
                console.log("bad image detected")
                return resolve("Inappropriate image")

            }
            else {
                console.log("good image")
                return resolve("Process Successful")
            }

        }
        catch (err) {
            console.log(err)
            reject("Process UnSuccessful")
        }
    }
    )

}

async function detectExplicitContentVideo(originalFileName) {

    const request = {
        inputUri: `./media/${originalFileName}`,
        features: ['SAFE_SEARCH_DETECTION']
    };

    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        try {
            console.log("test1")
            const [operation] = await clientVideoAI.annotateVideo(request);
            console.log("test2")
            const [result] = await operation.promise();

            console.log("test3")
            console.log('SafeSearch annotations:');
            result.annotationResults[0].safeSearchAnnotations.forEach(annotation => {
                console.log(`Time: ${annotation.timeOffset.seconds}.${annotation.timeOffset.nanos / 1000000}s`);
                console.log(`Adult: ${annotation.adult}`);
                console.log(`Spoof: ${annotation.spoof}`);
                console.log(`Medical: ${annotation.medical}`);
                console.log(`Violent: ${annotation.violent}`);
                console.log(`Racy: ${annotation.racy}`);
                console.log('----------------');
                resolve("Process Successful")
            }
            )
        }
        catch (err) {
            console.log(err)
            reject("Process UnSuccessful")
        }

    });
}

module.exports = {
    checkValidFile,
    conversionNeededCheck,
    writeFileToMemory,
    convertToWebp,
    convertToWebm,
    uploadToGCP,
    deleteFileFromMemory,
    detectExplicitContent,
    detectExplicitContentVideo
};
