var fs = require('fs');
var path = require('path');

var config = require('./config');
var LocalRouter = require('./local-router');
var AmapClient = require('./amap-client');
var testCaseGenerator = require('./test-case-generator');
var comparator = require('./comparator');
var Reporter = require('./reporter');

function run() {
  console.log('=== 西安地铁导航对比系统 ===');
  console.log('');

  var dataDir = path.resolve(__dirname, config.DATA_DIR);
  var stationsPath = path.join(dataDir, 'stations.json');
  var stationsData = JSON.parse(fs.readFileSync(stationsPath, 'utf-8')).stations;

  console.log('[1/5] 生成测试用例...');
  var testCases = testCaseGenerator.generate(stationsData, config);
  console.log('  生成 ' + testCases.length + ' 组测试用例 (手工: ' +
    testCases.filter(function (t) { return t.type === 'manual'; }).length +
    ', 随机: ' + testCases.filter(function (t) { return t.type === 'random'; }).length + ')');

  console.log('[2/5] 初始化本地路由器...');
  var router = new LocalRouter(config.DATA_DIR);
  console.log('  图节点: ' + router.graphData.nodes.length + ', 边: ' + router.graphData.edges.length);

  console.log('[3/5] 初始化高德客户端...');
  var amapClient = new AmapClient(config);

  console.log('[4/5] 执行对比 (' + testCases.length + ' 组)...');
  console.log('');

  var localResults = [];
  var amapResults = [];
  var compareResults = [];
  var completed = 0;
  var errors = 0;

  var chain = Promise.resolve();

  testCases.forEach(function (tc, index) {
    chain = chain.then(function () {
      var localResult = router.query(tc.origin, tc.dest, 0);
      localResults[index] = localResult;

      return amapClient.queryTransit(tc.originCoord, tc.destCoord, 0).then(function (amapResult) {
        amapResults[index] = amapResult;

        var cmp = comparator.compare(localResult, amapResult, config);
        compareResults[index] = cmp;

        completed++;
        var status = (cmp.local_ok && cmp.amap_ok) ? '✓' : '✗';
        var timeInfo = '';
        if (cmp.local_ok && cmp.amap_ok) {
          timeInfo = ' 本地:' + cmp.local_time_min.toFixed(1) + 'min 高德:' + cmp.amap_time_min.toFixed(1) + 'min 差:' + cmp.time_diff_min.toFixed(1) + 'min J:' + cmp.jaccard.toFixed(3);
        } else {
          timeInfo = ' 本地:' + (cmp.local_ok ? 'OK' : 'FAIL') + ' 高德:' + (cmp.amap_ok ? 'OK' : 'FAIL');
          if (cmp.local_error) timeInfo += ' [' + cmp.local_error + ']';
          if (cmp.amap_error) timeInfo += ' [' + cmp.amap_error + ']';
          errors++;
        }

        process.stdout.write('\r  ' + tc.id + ' ' + status + ' ' + tc.origin + '→' + tc.dest + timeInfo + '  (' + completed + '/' + testCases.length + ')');

        return sleep(50);
      });
    });
  });

  chain.then(function () {
    console.log('');
    console.log('');
    console.log('[5/5] 生成报告...');

    var outputDir = path.resolve(__dirname, config.OUTPUT_DIR);
    var reporter = new Reporter(outputDir);
    var paths = reporter.write(testCases, localResults, amapResults, compareResults);

    console.log('');
    console.log('=== 完成 ===');
    console.log('  总用例: ' + testCases.length);
    console.log('  成功对比: ' + (testCases.length - errors));
    console.log('  错误/失败: ' + errors);
    console.log('');
    console.log('  详细结果: ' + paths.rawPath);
    console.log('  汇总CSV:  ' + paths.csvPath);
    console.log('  统计数据: ' + paths.statsPath);
    console.log('');

    if (paths.stats.valid_count > 0) {
      var s = paths.stats;
      console.log('--- 统计摘要 ---');
      console.log('  平均耗时差: ' + s.time_diff.avg_min + ' min (' + s.time_diff.avg_pct + '%)');
      console.log('  本地更快: ' + s.time_diff.local_faster_count + ' | 高德更快: ' + s.time_diff.amap_faster_count + ' | 相同: ' + s.time_diff.equal_count);
      console.log('  Jaccard一致率: 平均 ' + s.jaccard.avg + ' | 中位 ' + s.jaccard.median + ' | 最低 ' + s.jaccard.min);
      console.log('  换乘一致率: ' + s.transfer.same_pct + '%');
      console.log('  线路一致率: ' + s.lines.match_pct + '%');
    }

    amapClient.destroy();
  }).catch(function (err) {
    console.error('Fatal error:', err);
    amapClient.destroy();
    process.exit(1);
  });
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

run();
