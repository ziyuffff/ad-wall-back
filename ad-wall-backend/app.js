const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const multer = require('multer');
const path = require('path');

const app = express();

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

// 3. 路径配置（避免同步初始化，改为路由内懒加载）
const adsPath = path.join(__dirname, 'ads.json');
const formConfigPath = path.join(__dirname, 'form-config.json');
const uploadsDir = path.join(__dirname, 'uploads');

// 4. multer配置（简化，避免冷启动阻塞）
const upload = multer({
  dest: uploadsDir, // 用简单的dest代替diskStorage，减少冷启动逻辑
  limits: { fileSize: 5 * 1024 * 1024 }
});

// 5. 工具函数：异步读取广告数据（路由内调用，避免冷启动阻塞）
const getAds = async () => {
  try {
    // 异步确保目录/文件存在
    await fs.ensureDir(uploadsDir);
    await fs.ensureFile(adsPath);
    const data = await fs.readFile(adsPath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (e) {
    console.error('读取广告数据失败：', e);
    return [];
  }
};

// 工具函数：异步保存广告数据
const saveAds = async (ads) => {
  try {
    await fs.writeFile(adsPath, JSON.stringify(ads || [], null, 2), 'utf8');
  } catch (e) {
    console.error('保存广告数据失败：', e);
  }
};

// 6. 根路径路由（最简逻辑，避免冷启动依赖）
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: '广告墙后端服务运行正常',
    docs: {
      广告列表: 'GET /api/ads',
      表单配置: 'GET /api/form-config'
    }
  });
});

// 7. 表单配置接口（异步容错）
app.get('/api/form-config', async (req, res) => {
  try {
    await fs.ensureFile(formConfigPath);
    const data = await fs.readFile(formConfigPath, 'utf8');
    const config = JSON.parse(data || JSON.stringify({
      title: '广告表单',
      fields: ['title', 'description', 'link', 'videos']
    }));
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '读取表单配置失败',
      error: error.message
    });
  }
});

// 8. 广告接口（全部改为异步，避免同步阻塞）
app.get('/api/ads', async (req, res) => {
  try {
    const ads = await getAds();
    res.status(200).json({ success: true, data: ads });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取广告列表失败',
      error: error.message
    });
  }
});

app.post('/api/ads', async (req, res) => {
  try {
    const ads = await getAds();
    const newAd = {
      id: Date.now().toString(),
      clicked: 0,
      videos: [],
      ...req.body
    };
    ads.push(newAd);
    await saveAds(ads);
    res.status(201).json({ success: true, data: newAd });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建广告失败',
      error: error.message
    });
  }
});

app.put('/api/ads/:id', async (req, res) => {
  try {
    let ads = await getAds();
    const index = ads.findIndex(ad => ad.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: '广告不存在' });
    }
    ads[index] = { ...ads[index], ...req.body };
    await saveAds(ads);
    res.status(200).json({ success: true, data: ads[index] });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新广告失败',
      error: error.message
    });
  }
});

app.delete('/api/ads/:id', async (req, res) => {
  try {
    let ads = await getAds();
    const initialLength = ads.length;
    ads = ads.filter(ad => ad.id !== req.params.id);
    if (ads.length === initialLength) {
      return res.status(404).json({ success: false, message: '广告不存在' });
    }
    await saveAds(ads);
    res.status(200).json({ success: true, message: '广告删除成功' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除广告失败',
      error: error.message
    });
  }
});

app.patch('/api/ads/:id/click', async (req, res) => {
  try {
    let ads = await getAds();
    const index = ads.findIndex(ad => ad.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: '广告不存在' });
    }
    ads[index].clicked = (ads[index].clicked || 0) + 1;
    await saveAds(ads);
    res.status(200).json({ success: true, data: ads[index] });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新点击数失败',
      error: error.message
    });
  }
});

// 9. 上传接口（简化multer配置）
app.post('/api/upload/video', upload.array('videos', 3), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: '请上传至少一个视频文件' });
    }
    const backendDomain = 'https://ad-wall-back.vercel.app';
    const videoUrls = req.files.map(file => `${backendDomain}/uploads/${file.filename}`);
    res.status(200).json({ success: true, data: videoUrls });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '视频上传失败',
      error: error.message
    });
  }
});

// 10. 静态文件服务（异步容错）
app.use('/uploads', async (req, res, next) => {
  try {
    await fs.ensureDir(uploadsDir);
    express.static(uploadsDir)(req, res, (err) => {
      if (err) {
        res.status(404).json({
          success: false,
          message: '上传的文件不存在（Vercel临时文件已清理）'
        });
      } else {
        next();
      }
    });
  } catch (e) {
    res.status(404).json({
      success: false,
      message: '上传目录不存在'
    });
  }
});

// 11. 404兜底
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    tip: '请访问 /api/ads 或 /api/form-config 查看有效接口'
  });
});

// 导出Express实例（核心：确保导出前无阻塞操作）
module.exports = app;
