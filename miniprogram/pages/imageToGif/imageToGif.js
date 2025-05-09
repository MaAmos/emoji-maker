import * as tfc from "@tensorflow/tfjs-converter";
import * as tf from "@tensorflow/tfjs-core";
import { createFetchFunc, fetchUrlHelpFn } from '../../utils/fetchUtil';
import GIFEncoder from '../../utils/gifEncoder';
var webgl = require('@tensorflow/tfjs-backend-webgl');
var plugin = requirePlugin('tfjsPlugin');

let globalModels = {
  mobilenet: null,
  styleModel: null
};

Page({
  data: {
    imagePath: '',
    gifPath: '',
    hasImage: false,
    loading: false,
    loadingText: '',
    modelLoaded: false,
    status: '',
    models: null,
    imageSize: 256
  },

  onLoad() {
    setTimeout(() => {
      this.initTensorFlow();
    }, 500);
  },

  async initTensorFlow() {
    try {
      this.setData({
        loading: true,
        loadingText: 'Initializing TensorFlow.js...'
      });

      await plugin.configPlugin({
        fetchFunc: wx.request,
        webgl,
        tf,
        canvas: wx.createOffscreenCanvas()
      });

      if (!tf) {
        throw new Error('TensorFlow.js initialization failed');
      }

      this.setData({ status: `TensorFlow.js backend: ${tf.getBackend()}` });
      await this.loadModelsFn();

      this.setData({
        loading: false,
        modelLoaded: true
      });
    } catch (error) {
      console.error('TensorFlow.js initialization failed:', error);
      this.setData({
        loading: false,
        status: `Initialization failed: ${error.message}`
      });

      wx.showToast({
        title: 'Initialization failed',
        icon: 'none'
      });
    }
  },

  async loadModelsFn() {
    this.setData({ loadingText: 'Loading models...' });

    try {
      const mobilenetResult = await wx.cloud.callFunction({
        name: 'getModel',
        data: { modelName: 'mobilenet' }
      });

      const styleResult = await wx.cloud.callFunction({
        name: 'getModel',
        data: { modelName: 'feature-vector' }
      });

      if (!mobilenetResult.result || !mobilenetResult.result.modelJson ||
          !styleResult.result || !styleResult.result.modelJson) {
        throw new Error('Failed to get model URL');
      }

      const mobilenetUrlMap = fetchUrlHelpFn(mobilenetResult.result.urls);
      const styleUrlMap = fetchUrlHelpFn(styleResult.result.urls);

      const mobilenetFetch = createFetchFunc(mobilenetUrlMap);
      const styleFetch = createFetchFunc(styleUrlMap);

      let mobilenet = null;
      try {
        mobilenet = await tfc.loadGraphModel(mobilenetResult.result.modelJson, {
          fetchFunc: mobilenetFetch
        });
      } catch (err) {
        console.error('Failed to load MobileNet model:', err);
      }

      let styleModel = null;
      try {
        styleModel = await tfc.loadGraphModel(styleResult.result.modelJson, {
          fetchFunc: styleFetch
        });
      } catch (err) {
        console.error('Failed to load style model:', err);
      }

      if (!mobilenet && !styleModel) {
        throw new Error('All models failed to load');
      }

      globalModels.mobilenet = mobilenet;
      globalModels.styleModel = styleModel;
      this.setData({
        modelLoaded: true,
        status: 'Models loaded successfully'
      });
    } catch (error) {
      console.error('Failed to load models:', error);
      throw new Error(`Model loading failed: ${error.message}`);
    }
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({
          imagePath: tempFilePath,
          hasImage: true,
          gifPath: ''
        });
      }
    });
  },

  async convertToGif() {
    if (!this.data.hasImage || !this.data.modelLoaded) {
      wx.showToast({
        title: 'Please select an image and ensure the model is loaded',
        icon: 'none'
      });
      return;
    }

    this.setData({
      loading: true,
      loadingText: 'Preparing to process...'
    });

    try {
      const imageData = await this.loadAndProcessImage(this.data.imagePath);
      const encoder = new GIFEncoder(this.data.imageSize, this.data.imageSize, {
        palette: this.createValidPalette(),
        loop: 0
      });

      await this.generateFrames(imageData, encoder);
      this.setData({ loadingText: 'Encoding GIF...' });
      const gifBuffer = encoder.encode();
      const gifPath = await GIFEncoder.saveToTempFile(gifBuffer);

      this.setData({
        gifPath,
        loading: false,
        status: 'GIF generated successfully'
      });

      tf.dispose(imageData);
    } catch (error) {
      console.error('Conversion process error:', error);
      this.setData({
        loading: false,
        status: `Conversion failed: ${error.message}`
      });

      wx.showToast({
        title: 'Conversion failed',
        icon: 'none'
      });
    }
  },

  createValidPalette() {
    const palette = [];
    palette.push(0x000000);
    palette.push(0xFFFFFF);
    palette.push(0xFF0000);
    palette.push(0x00FF00);
    palette.push(0x0000FF);
    palette.push(0xFFFF00);
    palette.push(0xFF00FF);
    palette.push(0x00FFFF);

    for (let i = 0; i < 32; i++) {
      const v = Math.floor(i * 8);
      palette.push((v << 16) | (v << 8) | v);
    }

    for (let r = 0; r < 6; r++) {
      for (let g = 0; g < 6; g++) {
        for (let b = 0; b < 6; b++) {
          if (palette.length < 256) {
            const rv = Math.floor(r * 51);
            const gv = Math.floor(g * 51);
            const bv = Math.floor(b * 51);
            palette.push((rv << 16) | (gv << 8) | bv);
          }
        }
      }
    }

    while (palette.length < 256) {
      palette.push(0x000000);
    }

    return palette;
  },

  async loadAndProcessImage(imagePath) {
    return new Promise((resolve, reject) => {
      this.setData({ loadingText: 'Loading image...' });

      try {
        const canvas = wx.createOffscreenCanvas({
          type: '2d',
          width: this.data.imageSize,
          height: this.data.imageSize
        });
        const ctx = canvas.getContext('2d');
        const img = canvas.createImage();

        img.onload = () => {
          ctx.clearRect(0, 0, this.data.imageSize, this.data.imageSize);
          const scale = Math.min(
            this.data.imageSize / img.width,
            this.data.imageSize / img.height
          );
          const width = img.width * scale;
          const height = img.height * scale;
          const x = (this.data.imageSize - width) / 2;
          const y = (this.data.imageSize - height) / 2;

          ctx.drawImage(img, x, y, width, height);
          const originalImageData = ctx.getImageData(0, 0, this.data.imageSize, this.data.imageSize);
          const size = this.data.imageSize * this.data.imageSize;
          const rgbData = new Uint8Array(size * 3);

          for (let i = 0; i < size; i++) {
            const srcIdx = i * 4;
            const destIdx = i * 3;
            rgbData[destIdx] = originalImageData.data[srcIdx];
            rgbData[destIdx + 1] = originalImageData.data[srcIdx + 1];
            rgbData[destIdx + 2] = originalImageData.data[srcIdx + 2];
          }

          const pixelsInput = {
            data: rgbData,
            width: this.data.imageSize,
            height: this.data.imageSize
          };

          const batched = tf.tidy(() => {
            let tensor = tf.browser.fromPixels(pixelsInput, 3);
            let floatTensor = tf.cast(tensor, 'float32');
            let normalized = tf.div(floatTensor, 255.0);
            return normalized.expandDims(0);
          });

          resolve(batched);
        };

        img.onerror = (err) => {
          reject(new Error('Image loading failed'));
        };

        img.src = imagePath;
      } catch (error) {
        reject(error);
      }
    });
  },

  async generateFrames(imageData, encoder) {
    const effects = [
      { name: 'Original', func: this.originalEffect.bind(this) },
      { name: 'Sharpen', func: this.sharpenEffect.bind(this) },
      { name: 'Grayscale', func: this.grayscaleEffect.bind(this) },
      { name: 'Invert', func: this.invertEffect.bind(this) },
      { name: 'Style Transfer 1', func: this.styleTransferEffect.bind(this, 1) },
      { name: 'Style Transfer 2', func: this.styleTransferEffect.bind(this, 2) }
    ];

    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      this.setData({ loadingText: `Applying effect: ${effect.name} (${i + 1}/${effects.length})` });
      const processedImage = await effect.func(imageData);
      const canvas = this.tensorToCanvas(processedImage);
      const ctx = canvas.getContext('2d');
      encoder.addFrame(ctx, { delay: 500 });
      tf.dispose(processedImage);
    }
  },

  async originalEffect(image) {
    return image.clone();
  },

  async sharpenEffect(image) {
    return tf.tidy(() => {
      let result = tf.squeeze(image);
      const contrastBoost = tf.mul(result, 1.3);
      return tf.expandDims(tf.clipByValue(contrastBoost, 0, 1), 0);
    });
  },

  async grayscaleEffect(image) {
    return tf.tidy(() => {
      let squeezed = tf.squeeze(image);
      const rgbData = squeezed.dataSync();
      const [height, width, channels] = squeezed.shape;
      const grayData = new Float32Array(height * width * 3);

      for (let i = 0; i < height * width; i++) {
        const offset = i * channels;
        const r = rgbData[offset];
        const g = rgbData[offset + 1];
        const b = rgbData[offset + 2];
        const grayValue = 0.299 * r + 0.587 * g + 0.114 * b;
        grayData[i * 3] = grayValue;
        grayData[i * 3 + 1] = grayValue;
        grayData[i * 3 + 2] = grayValue;
      }

      const grayTensor = tf.tensor3d(grayData, [height, width, 3]);
      return tf.expandDims(grayTensor, 0);
    });
  },

  async invertEffect(image) {
    return tf.sub(1, image);
  },

  async styleTransferEffect(styleIndex, image) {
    if (!globalModels.styleModel) {
      throw new Error('Style model not loaded');
    }

    const resizedImage = tf.image.resizeBilinear(image, [128, 128]);
    const adjustedImage = tf.mul(resizedImage, styleIndex === 1 ? 1.1 : 0.9);
    const modelResult = globalModels.styleModel.predict(adjustedImage);
    return tf.image.resizeBilinear(modelResult, [this.data.imageSize, this.data.imageSize]);
  },

  tensorToCanvas(tensor) {
    const canvas = wx.createOffscreenCanvas({
      type: '2d',
      width: this.data.imageSize,
      height: this.data.imageSize
    });
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(this.data.imageSize, this.data.imageSize);
    const data = tensor.dataSync();

    for (let i = 0; i < this.data.imageSize * this.data.imageSize; i++) {
      const destIdx = i * 4;
      const srcIdx = i * 3;
      imageData.data[destIdx] = data[srcIdx];
      imageData.data[destIdx + 1] = data[srcIdx + 1];
      imageData.data[destIdx + 2] = data[srcIdx + 2];
      imageData.data[destIdx + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  },

  saveGif() {
    if (!this.data.gifPath) {
      wx.showToast({
        title: 'Please generate a GIF first',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true, loadingText: 'Saving to album...' });

    wx.saveImageToPhotosAlbum({
      filePath: this.data.gifPath,
      success: () => {
        this.setData({ loading: false });
        wx.showToast({
          title: 'GIF saved to album',
          icon: 'success'
        });
      },
      fail: (err) => {
        console.error('Save failed:', err);
        this.setData({ loading: false });

        if (err.errMsg.indexOf('auth deny') >= 0) {
          wx.showModal({
            title: 'Prompt',
            content: 'Save failed, please authorize album permissions',
            confirmText: 'Go to authorize',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting();
              }
            }
          });
        } else {
          wx.showToast({
            title: 'Save failed',
            icon: 'none'
          });
        }
      }
    });
  },

  onUnload() {
    if (globalModels.mobilenet) {
      globalModels.mobilenet.dispose();
      globalModels.mobilenet = null;
    }
    if (globalModels.styleModel) {
      globalModels.styleModel.dispose();
      globalModels.styleModel = null;
    }

    if (this.data.gifPath) {
      const fs = wx.getFileSystemManager();
      fs.unlink({
        filePath: this.data.gifPath,
        fail: () => {}
      });
    }
  }
});