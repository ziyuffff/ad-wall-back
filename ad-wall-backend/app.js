const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 配置CORS：更灵活的跨域处理（兼容生产环境）
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://ad-wall-front.vercel.app' 
    : 'http://localhost:3000', // 开发环境允许本地前端
  credentials: true
}));

// 解析JSON请求体
app.use(express.json());

// 配置文件存储路径
const adsPath = path.join(__dirname, 'ads.json');
const formConfigPath = path.join(__dirname, 'form-config.json');
const uploadsDir = path.join(__dirname, 'uploads');

// 确保上传目录存在
fs.ensureDirSync(uploadsDir);

// 配置multer用于文件上传
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
  if (fs.existsSync(adsPath)) {
    return JSON.parse(fs.readFileSync(adsPath, 'utf8'));
  }
  return [];
};

// 保存广告数据（工具函数）
const saveAds = (ads) => {
  fs.writeFileSync(adsPath, JSON.stringify(ads, null, 2), 'utf8');
};

// 获取表单配置
app.get('/api/form-config', (req, res) => {
  try {
    if (fs.existsSync(formConfigPath)) {
      const config = JSON.parse(fs.readFileSync(formConfigPath, 'utf8'));
      res.json({ success: true, data: config });
    } else {
      res.status(404).json({ success: false, message: '表单配置不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: '读取表单配置失败' });
  }
});

// 广告相关接口
app.get('/api/ads', (req, res) => {
  try {
    const ads = getAds();
    res.json({ success: true, data: ads });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取广告列表失败' });
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
    res.status(500).json({ success: false, message: '创建广告失败' });
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
    res.status(500).json({ success: false, message: '更新广告失败' });
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
    res.status(500).json({ success: false, message: '删除广告失败' });
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
    res.status(500).json({ success: false, message: '更新点击数失败' });
  }
});

// 视频上传接口
app.post('/api/upload/video', upload.array('videos', 3), (req, res) => {
  try {
    const videoUrls = req.files.map(file => 
      `https://ad-wall-back.vercel.app/uploads/${file.filename}`
    );
    res.json({ success: true, data: videoUrls });
  } catch (error) {
    res.status(500).json({ success: false, message: '视频上传失败' });
  }
});

// 静态文件服务
app.use('/uploads', express.static(uploadsDir));

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 https://ad-wall-back.vercel.app (端口: ${PORT})`);
});