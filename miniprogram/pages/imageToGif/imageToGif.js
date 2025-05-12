Page({
  data: {
    imagePath: '',
    gifPath: '',
    hasImage: false,
    loading: false,
    loadingText: '',
    statusMessage: '',
    imageSize: 256
  },

  /**
   * 选择图片
   */
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
          gifPath: '', // 清空之前的GIF
          statusMessage: '图片已选择，点击"转换为GIF"按钮'
        });
      }
    });
  },

  /**
   * 将图片转换为GIF
   */
  async convertToGif() {
    if (!this.data.hasImage) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none'
      });
      return;
    }

    this.setData({
      loading: true,
      loadingText: '正在上传图片...',
      statusMessage: ''
    });

    try {
      // 1. 上传图片到云存储
      const cloudPath = `gif_source/${Date.now()}_${Math.random().toString(36).substr(2, 8)}.png`;
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath,
        filePath: this.data.imagePath
      });

      if (!uploadResult.fileID) {
        throw new Error('图片上传失败');
      }

      this.setData({ loadingText: '正在生成GIF...' });

      // 2. 调用云函数生成GIF
      const callResult = await wx.cloud.callFunction({
        name: 'createGif',
        data: {
          fileID: uploadResult.fileID,
          options: {
            imageSize: this.data.imageSize,
            effects: ['original', 'grayscale', 'invert', 'sepia', 'contrast']
          }
        }
      });

      if (!callResult.result || !callResult.result.fileID) {
        throw new Error('GIF生成失败: ' + (callResult.result?.error || '未知错误'));
      }

      // 3. 获取生成的GIF文件临时链接
      const getTempResult = await wx.cloud.getTempFileURL({
        fileList: [callResult.result.fileID]
      });

      if (!getTempResult.fileList || !getTempResult.fileList[0].tempFileURL) {
        throw new Error('获取文件链接失败');
      }

      const gifTempUrl = getTempResult.fileList[0].tempFileURL;

      // 4. 下载GIF到本地（可选，如果需要本地保存）
      const downloadResult = await this.downloadFile(gifTempUrl);

      this.setData({
        gifPath: downloadResult.tempFilePath,
        loading: false,
        statusMessage: 'GIF生成成功!'
      });
    } catch (error) {
      console.error('转换过程出错:', error);
      this.setData({
        loading: false,
        statusMessage: `转换失败: ${error.message || '未知错误'}`
      });

      wx.showToast({
        title: '转换失败',
        icon: 'none'
      });
    }
  },

  /**
   * 下载文件到本地
   */
  downloadFile(url) {
    return new Promise((resolve, reject) => {
      wx.downloadFile({
        url,
        success: resolve,
        fail: reject
      });
    });
  },

  /**
   * 预览GIF
   */
  previewGif() {
    if (this.data.gifPath) {
      wx.previewImage({
        urls: [this.data.gifPath],
        current: this.data.gifPath
      });
    }
  },

  /**
   * 保存GIF到相册
   */
  saveGif() {
    if (!this.data.gifPath) {
      wx.showToast({
        title: '请先生成GIF',
        icon: 'none'
      });
      return;
    }

    wx.saveImageToPhotosAlbum({
      filePath: this.data.gifPath,
      success: () => {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        console.error('保存失败:', err);
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
    });
  }
});