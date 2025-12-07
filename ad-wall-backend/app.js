const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const multer = require('multer');
const path = require('path');

const app = express();

// 1. 修正CORS：允许前端域名，兼容OPTIONS预检请求
app.use(cors({
  origin: ['https://ad-wall-front.vercel.app', 'https://ad-wall-back.vercel.app'], // 包含后端域名避免根路径跨域
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// 解析JSON请求体（处理空请求体容错）
app.use(express.json({ limit: '10mb', strict: false }));

// 2. 新增根路径路由处理（核心：解决根路径访问报错）
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

// 配置文件存储路径（Vercel Serverless临时文件系统，初始创建空文件避免读取失败）
const adsPath = path.join(__dirname, 'ads.json');
const formConfigPath = path.join(__dirname, 'form-config.json');
const uploadsDir = path.join(__dirname, 'uploads');

// 初始化临时文件/目录（核心：解决ads.json不存在导致的报错）
try {
  fs.ensureDirSync(uploadsDir);
  // 初始创建空的ads.json，避免读取时解析失败
  if (!fs.existsSync(adsPath)) {
    fs.writeFileSync(adsPath, JSON.stringify([], null, 2), 'utf8');
  }
  // 初始创建默认的form-config.json
  if (!fs.existsSync(formConfigPath)) {
    fs.writeFileSync(formConfigPath, JSON.stringify({
      title: '广告表单',
      fields: ['title', 'description', 'link', 'videos']
    }, null, 2), 'utf8');
  }
} catch (e) {
  console.error('初始化文件失败：', e);
}

// 配置multer（限制文件大小，避免超大文件报错）
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
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 限制5MB以内的文件
});

// 读取广告数据（工具函数）
const getAds = () => {
  try {
    const data = fs.readFileSync(adsPath, 'utf8');
    // 容错：空文件/无效JSON返回空数组
    return JSON.parse(data || '[]');
  } catch (e) {
    console.error('读取广告数据失败：', e);
    return [];
  }
};

// 保存广告数据（工具函数）
const saveAds = (ads) => {
  try {
    fs.writeFileSync(adsPath, JSON.stringify(ads || [], null, 2), 'utf8');
  } catch (e) {
    console.error('保存广告数据失败：', e);
  }
};

// 获取表单配置
app.get('/api/form-config', (req, res) => {
  try {
    const data = fs.readFileSync(formConfigPath, 'utf8');
    const config = JSON.parse(data || '{}');
    res.status(200).json({ 
      success: true, 
      data: config 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '读取表单配置失败', 
      error: error.message 
    });
  }
});

// 广告相关接口
app.get('/api/ads', (req, res) => {
  try {
    const ads = getAds();
    res.status(200).json({ 
      success: true, 
      data: ads 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '获取广告列表失败', 
      error: error.message 
    });
  }
});

app.post('/api/ads', (req, res) => {
  try {
    const ads = getAds();
    const newAd = {
      id: Date.now().toString(),
      clicked: 0,
      videos: [],
      ...req.body // 兼容前端传参，避免属性缺失
    };
    ads.push(newAd);
    saveAds(ads);
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
    let ads = getAds();
    const index = ads.findIndex(ad => ad.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ 
        success: false, 
        message: '广告不存在' 
      });
    }
    ads[index] = { ...ads[index], ...req.body };
    saveAds(ads);
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
    let ads = getAds();
    const initialLength = ads.length;
    ads = ads.filter(ad => ad.id !== req.params.id);
    
    if (ads.length === initialLength) {
      return res.status(404).json({ 
        success: false, 
        message: '广告不存在' 
      });
    }
    
    saveAds(ads);
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
    let ads = getAds();
    const index = ads.findIndex(ad => ad.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ 
        success: false, 
        message: '广告不存在' 
      });
    }
    ads[index].clicked = (ads[index].clicked || 0) + 1;
    saveAds(ads);
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

// 视频上传接口（容错：无文件时返回提示）
app.post('/api/upload/video', upload.array('videos', 3), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: '请上传至少一个视频文件' 
      });
    }
    const backendDomain = 'https://ad-wall-back.vercel.app'; 
    const videoUrls = req.files.map(file => 
      `${backendDomain}/uploads/${file.filename}`
    );
    res.status(200).json({ 
      success: true, 
      data: videoUrls 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '视频上传失败', 
      error: error.message 
    });
  }
});

// 静态文件服务（容错：文件不存在时返回404提示）
app.use('/uploads', (req, res, next) => {
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
});

// 404兜底路由（匹配所有未定义的路径）
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: '接口不存在',
    tip: '请访问 /api/ads 或 /api/form-config 查看有效接口'
  });
});

// 核心：导出Express实例供Vercel Serverless调用
module.exports = app;
