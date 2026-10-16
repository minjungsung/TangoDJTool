const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Keep review evidence portable without persisting workstation configuration.
module.exports = class PortableReviewReporter {
  onBegin(config, suite) { this.suite = suite; }
  onEnd(result) {
    const clean = value => String(value).split(process.cwd()).join('.').split(os.homedir()).join('<home>');
    const tests = this.suite.allTests().map(test => ({
      project: test.parent.project()?.name,
      title: test.title,
      file: path.relative(process.cwd(), test.location.file),
      line: test.location.line,
      outcome: test.outcome(),
      results: test.results.map(run => ({ status: run.status, duration: run.duration, errors: run.errors.map(error => clean(error.message || error.value || 'Unknown error')) })),
    }));
    fs.mkdirSync('reports/feature-review', { recursive: true });
    fs.writeFileSync(process.env.REVIEW_REPORT || 'reports/feature-review/results.json', JSON.stringify({ status: result.status, duration: result.duration, tests }, null, 2) + '\n');
  }
};
