const cloud = require('wx-server-sdk');
const fs = require('fs');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const bucket = 'your-cloud-storage-bucket-name'; // Replace with your cloud storage bucket name

exports.main = async (event, context) => {
  const { fileContent, fileName } = event;

  if (!fileContent || !fileName) {
    return {
      code: 400,
      message: 'Invalid parameters'
    };
  }

  try {
    // Decode base64 string
    const buffer = Buffer.from(fileContent, 'base64');

    // Upload to cloud storage
    const uploadResult = await cloud.uploadFile({
      cloudPath: `uploads/${fileName}`,
      fileContent: buffer,
      fileId: `${bucket}/${fileName}`
    });

    return {
      code: 200,
      message: 'Upload successful',
      fileId: uploadResult.fileID
    };
  } catch (error) {
    console.error('Upload failed:', error);
    return {
      code: 500,
      message: 'Upload failed',
      error: error.message
    };
  }
};