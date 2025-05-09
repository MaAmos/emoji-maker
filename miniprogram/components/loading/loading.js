Page({
  data: {
    loading: false,
    loadingText: '加载中...'
  },

  showLoading(text = '加载中...') {
    this.setData({
      loading: true,
      loadingText: text
    });
  },

  hideLoading() {
    this.setData({
      loading: false
    });
  }
});