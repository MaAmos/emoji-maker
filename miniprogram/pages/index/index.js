Page({
  data: {
    imagePath: '',
    gifPath: '',
    hasImage: false,
    loading: false,
    loadingText: '',
    status: ''
  },

  onLoad() {
    // 页面加载时的初始化逻辑
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
          gifPath: '' // 清空之前的GIF结果
        });
      }
    });
  },

  uploadImage() {
    if (!this.data.hasImage) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none'
      });
      return;
    }

    this.setData({
      loading: true,
      loadingText: '上传图片...'
    });

    wx.cloud.uploadFile({
      cloudPath: `uploads/${Date.now()}.png`, // 生成唯一文件名
      filePath: this.data.imagePath,
      success: res => {
        console.log('上传成功', res);
        this.setData({
          loading: false,
          status: '上传成功'
        });
        // 这里可以调用转换GIF的云函数
      },
      fail: err => {
        console.error('上传失败', err);
        this.setData({
          loading: false,
          status: '上传失败'
        });
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        });
      }
    });
  }
});