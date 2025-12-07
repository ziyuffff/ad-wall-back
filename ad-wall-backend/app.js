const express = require('express');
const server = express();

// 1. 基础配置
server.use(express.json({ limit: '10mb', strict: false }));
server.use((req, res, next) => {
  // 跨域配置（直接写在中间件里，避免cors包的额外依赖）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// 2. 内存存储（无文件操作，避免崩溃）
let ads = [];
const formConfig = {
  title: '广告表单',
  fields: ['title', 'description', 'link', 'videos']
};

// 3. 路由定义
server.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: '广告墙后端服务运行正常',
    docs: {
      广告列表: 'GET /api/ads',
      表单配置: 'GET /api/form-config'
    }
  });
});

server.get('/api/form-config', (req, res) => {
  res.status(200).json({ success: true, data: formConfig });
});

server.get('/api/ads', (req, res) => {
  res.status(200).json({ success: true, data: ads });
});

server.post('/api/ads', (req, res) => {
  try {
    const newAd = {
      id: Date.now().toString(),
      clicked: 0,
      videos: [],
      ...req.body
    };
    ads.push(newAd);
    res.status(201).json({ success: true, data: newAd });
  } catch (err) {
    res.status(500).json({ success: false, message: '创建广告失败', error: err.message });
  }
});

server.put('/api/ads/:id', (req, res) => {
  try {
    const index = ads.findIndex(ad => ad.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: '广告不存在' });
    ads[index] = { ...ads[index], ...req.body };
    res.status(200).json({ success: true, data: ads[index] });
  } catch (err) {
    res.status(500).json({ success: false, message: '更新广告失败', error: err.message });
  }
});

server.delete('/api/ads/:id', (req, res) => {
  try {
    const initialLen = ads.length;
    ads = ads.filter(ad => ad.id !== req.params.id);
    if (ads.length === initialLen) return res.status(404).json({ success: false, message: '广告不存在' });
    res.status(200).json({ success: true, message: '广告删除成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: '删除广告失败', error: err.message });
  }
});

server.patch('/api/ads/:id/click', (req, res) => {
  try {
    const index = ads.findIndex(ad => ad.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: '广告不存在' });
    ads[index].clicked = (ads[index].clicked || 0) + 1;
    res.status(200).json({ success: true, data: ads[index] });
  } catch (err) {
    res.status(500).json({ success: false, message: '更新点击数失败', error: err.message });
  }
});

// 4. 404兜底
server.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    tip: '有效接口：/api/ads、/api/form-config'
  });
});

// 5. 核心：导出Vercel Serverless兼容的请求处理函数
module.exports = (req, res) => {
  // 确保Express处理完所有路由
  server(req, res);
};
