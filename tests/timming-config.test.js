const test = require('node:test');
const assert = require('node:assert/strict');

const timmingConfig = require('../config/timming');

function findTask(name) {
  return timmingConfig.find((item) => item.name === name);
}

test('timming config includes collect tasks for 1day and 2day ranges', () => {
  const task1day = findTask('collect_1day');
  const task2day = findTask('collect_2day');

  assert.ok(task1day, 'collect_1day should exist');
  assert.ok(task2day, 'collect_2day should exist');
  assert.equal(task1day.file, 'collect');
  assert.equal(task2day.file, 'collect');
  assert.equal(task1day.param.type, '1day');
  assert.equal(task2day.param.type, '2day');
});

test('timming config includes rolling hit reset tasks for day week and month', () => {
  const dayTask = findTask('hits_day_reset');
  const weekTask = findTask('hits_week_reset');
  const monthTask = findTask('hits_month_reset');

  assert.ok(dayTask, 'hits_day_reset should exist');
  assert.ok(weekTask, 'hits_week_reset should exist');
  assert.ok(monthTask, 'hits_month_reset should exist');

  assert.equal(dayTask.file, 'hits');
  assert.equal(dayTask.param.scope, 'day');
  assert.equal(dayTask.hours, '00');

  assert.equal(weekTask.file, 'hits');
  assert.equal(weekTask.param.scope, 'week');
  assert.equal(weekTask.weeks, '1');

  assert.equal(monthTask.file, 'hits');
  assert.equal(monthTask.param.scope, 'month');
  assert.equal(monthTask.monthdays, '1');
  assert.equal(monthTask.hours, '00');
});
