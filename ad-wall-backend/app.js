const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const multer = require('multer');
const path = require('path');

const app = express();
// 1. 移除Serverless无效的PORT和listen代码
// 2. 修正CORS：固定前端域名，避免NODE_ENV未定义导致跨域失效
app.use(cors({
  origin: 'https://ad-wall-front.vercel.app', 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 解析JSON请求体
app.use(express.json());

// 配置文件存储路径（注意：Vercel Serverless中文件读写仅临时有效）
const adsPath = path.join(__dirname, 'ads.json');
const formConfigPath = path.join(__dirname, 'form-config.json');
const uploadsDir = path.join(__dirname, 'uploads');

// 确保目录存在（临时目录，部署后每次请求都会重建）
fs.ensureDirSync(uploadsDir);

// 配置multer（Vercel Serverless中文件上传仅临时保存，建议替换为云存储如阿里云OSS/腾讯云COS）
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

// 读取广告数据（工具函数）
const getAds = () => {
  try {
    if (fs.existsSync(adsPath)) {
      return JSON.parse(fs.readFileSync(adsPath, 'utf8'));
    }
    return [];
  } catch (e) {
    return []; // 容错：文件读取失败返回空数组
  }
};

// 保存广告数据（工具函数）
const saveAds = (ads) => {
  try {
    fs.writeFileSync(adsPath, JSON.stringify(ads, null, 2), 'utf8');
  } catch (e) {
    console.error('保存广告数据失败：', e);
  }
};

// 获取表单配置
app.get('/api/form-config', (req, res) => {
  try {
    if (fs.existsSync(formConfigPath)) {
      const config = JSON.parse(fs.readFileSync(formConfigPath, 'utf8'));
      res.json({ success: true, data: config });
    } else {
      // 容错：配置文件不存在时返回默认配置（避免404）
      res.json({ success: true, data: { title: '广告表单', fields: ['title', 'desc', 'link'] } });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: '读取表单配置失败', error: error.message });
  }
});

// 广告相关接口
app.get('/api/ads', (req, res) => {
  try {
    const ads = getAds();
    res.json({ success: true, data: ads });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取广告列表失败', error: error.message });
  }
});

app.post('/api/ads', (req, res) => {
  try {
    const ads = getAds();
    const newAd = {
      id: Date.now().toString(),
      ...req.body,
      clicked: 0,
      videos: req.body.videos || []
    };
    ads.push(newAd);
    saveAds(ads);
    res.status(201).json({ success: true, data: newAd });
  } catch (error) {
    res.status(500).json({ success: false, message: '创建广告失败', error: error.message });
  }
});

app.put('/api/ads/:id', (req, res) => {
  try {
    let ads = getAds();
    const index = ads.findIndex(ad => ad.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: '广告不存在' });
    }
    ads[index] = { ...ads[index], ...req.body };
    saveAds(ads);
    res.json({ success: true, data: ads[index] });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新广告失败', error: error.message });
  }
});

app.delete('/api/ads/:id', (req, res) => {
  try {
    let ads = getAds();
    const initialLength = ads.length;
    ads = ads.filter(ad => ad.id !== req.params.id);
    
    if (ads.length === initialLength) {
      return res.status(404).json({ success: false, message: '广告不存在' });
    }
    
    saveAds(ads);
    res.json({ success: true, message: '广告删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除广告失败', error: error.message });
  }
});

app.patch('/api/ads/:id/click', (req, res) => {
  try {
    let ads = getAds();
    const index = ads.findIndex(ad => ad.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: '广告不存在' });
    }
    ads[index].clicked = (ads[index].clicked || 0) + 1;
    saveAds(ads);
    res.json({ success: true, data: ads[index] });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新点击数失败', error: error.message });
  }
});

// 视频上传接口（注意：Vercel临时文件系统中，上传的文件会在请求结束后被清理）
app.post('/api/upload/video', upload.array('videos', 3), (req, res) => {
  try {
    // 替换为你的后端Vercel域名
    const backendDomain = 'https://ad-wall-back.vercel.app'; 
    const videoUrls = req.files.map(file => 
      `${backendDomain}/uploads/${file.filename}`
    );
    res.json({ success: true, data: videoUrls });
  } catch (error) {
    res.status(500).json({ success: false, message: '视频上传失败', error: error.message });
  }
});

// 静态文件服务（临时生效）
app.use('/uploads', express.static(uploadsDir));

// 核心：导出Express实例供Vercel Serverless调用
module.exports = app;
