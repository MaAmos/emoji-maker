const cloud = require('wx-server-sdk');
const GIFEncoder = require('gifencoder');
const Jimp = require('jimp');

cloud.init();

exports.main = async (event, context) => {
  const { fileID } = event;

  if (!fileID) {
    return {
      code: 400,
      message: '缺少文件ID'
    };
  }

  try {
    // 从云存储获取图片
    const file = await cloud.downloadFile({
      fileID: fileID
    });

    const image = await Jimp.read(file.tempFilePath);
    const gifEncoder = new GIFEncoder(image.bitmap.width, image.bitmap.height);
    
    gifEncoder.start();
    gifEncoder.setRepeat(0); // 0: loop forever
    gifEncoder.setDelay(500); // frame delay in ms
    gifEncoder.setQuality(10); // image quality

    // 添加帧到GIF
    gifEncoder.addFrame(image.bitmap.data);
    
    // 完成GIF编码
    gifEncoder.finish();

    // 保存GIF到临时文件
    const gifBuffer = gifEncoder.out.getData();
    const gifFilePath = `/tmp/output.gif`;
    await cloud.uploadFile({
      cloudPath: `gifs/${Date.now()}.gif`,
      fileContent: gifBuffer
    });

    return {
      code: 200,
      message: 'GIF生成成功',
      gifFilePath
    };
  } catch (error) {
    return {
      code: 500,
      message: `生成GIF失败: ${error.message}`
    };
  }
};