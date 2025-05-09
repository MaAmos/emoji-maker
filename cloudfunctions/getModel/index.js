const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { modelName } = event;

  try {
    // 根据模型名称获取模型信息
    const modelData = await db.collection('models').where({
      name: modelName
    }).get();

    if (modelData.data.length === 0) {
      return {
        success: false,
        message: '模型未找到'
      };
    }

    return {
      success: true,
      result: modelData.data[0]
    };
  } catch (error) {
    return {
      success: false,
      message: `获取模型失败: ${error.message}`
    };
  }
};