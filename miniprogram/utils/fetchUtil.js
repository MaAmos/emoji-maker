import wx from 'wx-server-sdk';

wx.init({
  env: 'your-env-id' // Replace with your cloud environment ID
});

const db = wx.database();

export const uploadImage = async (imageData) => {
  try {
    const filePath = `images/${Date.now()}.png`; // Generate a unique file name
    const result = await wx.cloud.uploadFile({
      cloudPath: filePath,
      fileContent: imageData
    });
    return result.fileID; // Return the file ID for further processing
  } catch (error) {
    console.error('Image upload failed:', error);
    throw new Error('Image upload failed');
  }
};

export const fetchImage = async (fileID) => {
  try {
    const result = await wx.cloud.downloadFile({
      fileID: fileID
    });
    return result.tempFilePath; // Return the temporary file path
  } catch (error) {
    console.error('Image fetch failed:', error);
    throw new Error('Image fetch failed');
  }
};