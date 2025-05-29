#!/usr/bin/env node

/**
 * 系统状态检查脚本
 * 用于检查Redis连接、分类配置等
 */

const { exec } = require('child_process');
const path = require('path');

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 检查Redis连接
function checkRedis() {
  return new Promise((resolve) => {
    exec('redis-cli ping', (error, stdout, stderr) => {
      if (error) {
        log('❌ Redis 连接失败', 'red');
        log(`   错误: ${error.message}`, 'red');
        resolve(false);
      } else if (stdout.trim() === 'PONG') {
        log('✅ Redis 连接正常', 'green');
        resolve(true);
      } else {
        log('⚠️  Redis 响应异常', 'yellow');
        log(`   响应: ${stdout}`, 'yellow');
        resolve(false);
      }
    });
  });
}

// 检查Docker容器状态
function checkDocker() {
  return new Promise((resolve) => {
    exec('docker ps --filter name=sz-room --format "table {{.Names}}\t{{.Status}}"', (error, stdout, stderr) => {
      if (error) {
        log('⚠️  Docker 检查失败（可能未安装Docker）', 'yellow');
        resolve(false);
      } else {
        const lines = stdout.trim().split('\n');
        if (lines.length > 1) {
          log('🐳 Docker 容器状态:', 'blue');
          lines.forEach(line => {
            if (line.includes('NAMES') || line.includes('Up')) {
              log(`   ${line}`, line.includes('Up') ? 'green' : 'blue');
            } else if (line.trim()) {
              log(`   ${line}`, 'red');
            }
          });
        } else {
          log('⚠️  未找到相关Docker容器', 'yellow');
        }
        resolve(true);
      }
    });
  });
}

// 检查环境配置
function checkEnvConfig() {
  const fs = require('fs');
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    log('❌ .env 文件不存在', 'red');
    log('   请复制 env.example 并配置环境变量', 'yellow');
    return false;
  }
  
  log('✅ .env 文件存在', 'green');
  
  // 检查关键配置项
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = [
    'FEISHU_WEBHOOK_URL',
    'FEISHU_APP_ID',
    'CRAWLER_BASE_URL'
  ];
  
  let hasFeishuConfig = false;
  
  requiredVars.forEach(varName => {
    const regex = new RegExp(`^${varName}=(.+)$`, 'm');
    const match = envContent.match(regex);
    if (match && match[1] && match[1] !== 'your_value_here' && match[1] !== '') {
      if (varName.startsWith('FEISHU_')) {
        hasFeishuConfig = true;
      }
    }
  });
  
  if (hasFeishuConfig) {
    log('✅ 飞书配置已设置', 'green');
  } else {
    log('⚠️  飞书配置未完成', 'yellow');
    log('   请配置 FEISHU_WEBHOOK_URL 或 FEISHU_APP_ID 等参数', 'yellow');
  }
  
  return true;
}

// 检查分类规则
function checkCategoryRules() {
  const fs = require('fs');
  
  // 检查分类规则JSON文件
  const rulesPath = path.join(__dirname, 'src', 'config', 'categoryRules.json');
  if (!fs.existsSync(rulesPath)) {
    log('❌ 分类规则文件不存在: src/config/categoryRules.json', 'red');
    return false;
  }
  
  try {
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');
    const rules = JSON.parse(rulesContent);
    
    if (Array.isArray(rules) && rules.length > 0) {
      log(`✅ 分类规则文件正常 (${rules.length} 个分类)`, 'green');
      rules.forEach(rule => {
        if (rule.name && Array.isArray(rule.keywords) && typeof rule.priority === 'number') {
          log(`   📂 ${rule.name}: ${rule.keywords.length} 个关键词 (优先级: ${rule.priority})`, 'blue');
        } else {
          log(`   ⚠️  规则格式异常: ${JSON.stringify(rule)}`, 'yellow');
        }
      });
      return true;
    } else {
      log('❌ 分类规则文件格式错误', 'red');
      return false;
    }
  } catch (error) {
    log('❌ 分类规则文件解析失败:', 'red');
    log(`   错误: ${error.message}`, 'red');
    return false;
  }
}

// 主函数
async function main() {
  log('🔍 系统状态检查开始...', 'blue');
  log('=' * 50, 'blue');
  
  // 检查环境配置
  log('\n📋 检查环境配置:', 'blue');
  checkEnvConfig();
  
  // 检查分类规则
  log('\n📂 检查分类规则:', 'blue');
  checkCategoryRules();
  
  // 检查Redis
  log('\n🔗 检查Redis连接:', 'blue');
  await checkRedis();
  
  // 检查Docker
  log('\n🐳 检查Docker容器:', 'blue');
  await checkDocker();
  
  log('\n🎉 状态检查完成！', 'green');
  
  // 显示快速命令
  log('\n📋 常用命令:', 'blue');
  log('   启动服务: docker-compose up -d', 'yellow');
  log('   查看日志: docker-compose logs -f sz-room-crawler', 'yellow');
  log('   手动构建: npm run build', 'yellow');
  log('   手动运行: npm start', 'yellow');
  log('   Redis命令: redis-cli', 'yellow');
}

// 运行检查
main().catch(error => {
  log(`❌ 检查过程出错: ${error.message}`, 'red');
  process.exit(1);
}); 