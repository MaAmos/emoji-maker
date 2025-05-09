App({
  onLaunch() {
    // 小程序初始化时的逻辑
    console.log('小程序启动');
  },

  onShow() {
    // 小程序显示时的逻辑
    console.log('小程序显示');
  },

  onHide() {
    // 小程序隐藏时的逻辑
    console.log('小程序隐藏');
  },

  globalData: {
    userInfo: null
  }
});