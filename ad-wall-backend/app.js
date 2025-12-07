const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 跨域配置（优先加载）
app.use(cors({
  origin: ['https://ad-wall-front.vercel.app', 'https://ad-wall-back.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// 2. 解析请求体
app.use(express.json({ limit: '10mb', strict: false }));

// 3. 内存存储（替代本地文件，解决Vercel文件操作崩溃）
let ads = []; // 广告数据
const formConfig = {
  title: '广告表单',
  fields: ['title', 'description', 'link', 'videos']
};

// 4. 根路径路由（最简逻辑）
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: '广告墙后端服务运行正常',
    docs: {
      广告列表: 'GET /api/ads',
      创建广告: 'POST /api/ads',
      表单配置: 'GET /api/form-config'
    }
  });
});

// 5. 表单配置接口
app.get('/api/form-config', (req, res) => {
  res.status(200).json({
    success: true,
    data: formConfig
  });
});

// 6. 广告接口（纯内存操作，无文件依赖）
app.get('/api/ads', (req, res) => {
  res.status(200).json({
    success: true,
    data: ads
  });
});

app.post('/api/ads', (req, res) => {
  try {
    const newAd = {
      id: Date.now().toString(),
      clicked: 0,
      videos: [],
      ...req.body
    };
    ads.push(newAd);
    res.status(201).json({
      success: true,
      data: newAd
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建广告失败',
      error: error.message
    });
  }
});

app.put('/api/ads/:id', (req, res) => {
  try {
    const index = ads.findIndex(ad => ad.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: '广告不存在' });
    }
    ads[index] = { ...ads[index], ...req.body };
    res.status(200).json({
      success: true,
      data: ads[index]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新广告失败',
      error: error.message
    });
  }
});

app.delete('/api/ads/:id', (req, res) => {
  try {
    const initialLength = ads.length;
    ads = ads.filter(ad => ad.id !== req.params.id);
    if (ads.length === initialLength) {
      return res.status(404).json({ success: false, message: '广告不存在' });
    }
    res.status(200).json({
      success: true,
      message: '广告删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除广告失败',
      error: error.message
    });
  }
});

app.patch('/api/ads/:id/click', (req, res) => {
  try {
    const index = ads.findIndex(ad => ad.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: '广告不存在' });
    }
    ads[index].clicked = (ads[index].clicked || 0) + 1;
    res.status(200).json({
      success: true,
      data: ads[index]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新点击数失败',
      error: error.message
    });
  }
});

// 7. 404兜底路由
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    tip: '请访问 /api/ads 或 /api/form-config 查看有效接口'
  });
});

// 8. 导出Express实例（无阻塞操作）
module.exports = app;
