const { config } = require('./dist/config/config');

console.log('分类规则数量:', config.filter.categoryRules.length);
console.log('\n分类详情:');
config.filter.categoryRules.forEach(rule => {
  console.log(`- ${rule.name}: ${rule.keywords.length} 个关键词 (优先级: ${rule.priority})`);
});

console.log('\nRedis配置:');
console.log(`- Host: ${config.redis.host}:${config.redis.port}`);
console.log(`- DB: ${config.redis.db}`);
console.log(`- Key Prefix: ${config.redis.keyPrefix}`);
console.log(`- TTL: ${config.redis.ttl}秒`); 