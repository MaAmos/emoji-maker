const cloud = require('wx-server-sdk');
const sharp = require('sharp');
const GIFEncoder = require('gifencoder');
const { createCanvas, Image } = require('canvas');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * 下载云存储中的文件到本地临时目录
 * @param {string} fileID - 云存储文件ID
 * @returns {Promise<string>} 本地临时文件路径
 */
async function downloadFile(fileID) {
  const res = await cloud.downloadFile({
    fileID
  });
  return res.tempFilePath;
}

/**
 * 将临时文件上传到云存储
 * @param {string} filePath - 本地文件路径
 * @param {string} cloudPath - 云端文件路径
 * @returns {Promise<string>} 云文件ID
 */
async function uploadFile(filePath, cloudPath) {
  const res = await cloud.uploadFile({
    cloudPath,
    filePath
  });
  return res.fileID;
}

/**
 * 处理图像效果
 * @param {Buffer} imageBuffer - 图像数据Buffer
 * @param {string} effect - 效果名称
 * @returns {Promise<Buffer>} 处理后的图像数据
 */
async function applyEffect(imageBuffer, effect) {
  let processedImage = sharp(imageBuffer);

  switch (effect) {
    case 'grayscale':
      processedImage = processedImage.grayscale();
      break;
    case 'invert':
      processedImage = processedImage.negate();
      break;
    case 'sepia':
      // 使用色彩转换矩阵实现复古效果
      processedImage = processedImage.recomb([
        [0.393, 0.769, 0.189],
        [0.349, 0.686, 0.168],
        [0.272, 0.534, 0.131]
      ]);
      break;
    case 'contrast':
      processedImage = processedImage.contrast(0.5);
      break;
    case 'blur':
      processedImage = processedImage.blur(5);
      break;
    case 'original':
    default:
      // 不做处理
      break;
  }

  return processedImage.toBuffer();
}

/**
 * 创建GIF动画
 * @param {Buffer} imageBuffer - 原始图像数据
 * @param {Object} options - 选项
 * @returns {Promise<string>} 生成的GIF文件路径
 */
async function createGif(imageBuffer, options = {}) {
  const {
    imageSize = 256,
    effects = ['original', 'grayscale', 'invert'],
    frameDelay = 500 // 每帧延迟，毫秒
  } = options;

  // 调整图像大小
  const resizedBuffer = await sharp(imageBuffer)
    .resize(imageSize, imageSize, { fit: 'cover' })
    .toBuffer();

  // 创建GIF编码器
  const encoder = new GIFEncoder(imageSize, imageSize);
  const gifFilePath = path.join(os.tmpdir(), `output_${Date.now()}.gif`);
  const writeStream = fs.createWriteStream(gifFilePath);

  // 初始化GIF流
  encoder.createReadStream().pipe(writeStream);
  encoder.start();
  encoder.setRepeat(0); // 0表示无限循环
  encoder.setDelay(frameDelay);
  encoder.setQuality(10); // 质量，1-30，越低质量越好

  // 创建Canvas用于处理帧
  const canvas = createCanvas(imageSize, imageSize);
  const ctx = canvas.getContext('2d');

  // 加载图像
  const image = new Image();

  // 处理每个效果
  for (const effect of effects) {
    try {
      console.log(`处理效果: ${effect}`);
      const processedBuffer = await applyEffect(resizedBuffer, effect);

      // 加载到Image对象
      image.src = processedBuffer;

      // 绘制到Canvas
      ctx.clearRect(0, 0, imageSize, imageSize);
      ctx.drawImage(image, 0, 0, imageSize, imageSize);

      // 添加到GIF
      encoder.addFrame(ctx);

      console.log(`效果 ${effect} 添加完成`);
    } catch (error) {
      console.error(`处理效果 ${effect} 时出错:`, error);
      // 继续处理下一个效果
    }
  }

  // 结束GIF编码
  encoder.finish();

  // 等待流完成
  await new Promise((resolve) => {
    writeStream.on('finish', resolve);
  });

  console.log('GIF生成完成:', gifFilePath);
  return gifFilePath;
}

// 云函数主入口
exports.main = async (event, context) => {
  try {
    // 检查参数
    if (!event.fileID) {
      return {
        error: '缺少fileID参数'
      };
    }

    // 获取源图像
    const sourceImagePath = await downloadFile(event.fileID);
    const imageBuffer = fs.readFileSync(sourceImagePath);

    // 创建GIF
    const gifPath = await createGif(imageBuffer, event.options || {});

    // 上传GIF到云存储
    const cloudPath = `gif_output/${Date.now()}_${Math.random().toString(36).substr(2, 8)}.gif`;
    const fileID = await uploadFile(gifPath, cloudPath);

    // 清理临时文件
    fs.unlinkSync(gifPath);
    fs.unlinkSync(sourceImagePath);

    return {
      fileID,
      success: true
    };
  } catch (error) {
    console.error('处理失败:', error);
    return {
      error: error.message,
      success: false
    };
  }
};