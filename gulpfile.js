var path = require('path');
var fs = require('fs');
var gulp = require('gulp');
var less = require('gulp-less');
var header = require('gulp-header');
var tap = require('gulp-tap');
var nano = require('gulp-cssnano');
var postcss = require('gulp-postcss');
var autoprefixer = require('autoprefixer');
var comments = require('postcss-discard-comments');
var rename = require('gulp-rename');
var browserSync = require('browser-sync');
var pkg = require('./package.json');
var convertCssVar = require('gulp-convert-css-var');
var del = require('del');
const { src, dest, series, parallel, watch } = gulp
const bs = browserSync.create()

var yargs = require('yargs').options({
  w: {
      alias: 'watch',
      type: 'boolean',
  },
  s: {
      alias: 'server',
      type: 'boolean',
  },
  p: {
      alias: 'port',
      type: 'number',
  },
}).argv;

var option = { 
  base: 'src',
  dist: __dirname + '/dist'
};

const clean = () => {
  return del(['dist', 'temp'])
}


const build_style = () => {
  var banner = [
    '/*!',
    ' * v<%= pkg.version %> (<%= pkg.homepage %>)',
    ' * Copyright <%= new Date().getFullYear() %>',
    ' * Licensed under the <%= pkg.license %> license',
    ' */',
    '',
  ].join('\n');
  return src('src/style/weui.less', { base: option.base })
    .pipe(
      less().on('error', function(e) {
        console.error(e.message);
        this.emit('end');
      }),
    )
    .pipe(postcss([autoprefixer(['iOS >= 7', 'Android >= 4.1']), comments()]))
    .pipe(convertCssVar())
    .pipe(header(banner, { pkg: pkg }))
    .pipe(dest(option.dist))
    .pipe(browserSync.reload({ stream: true }))
    .pipe(
      nano({
        zindex: false,
        autoprefixer: false,
        svgo: false,
      }),
    )
    .pipe(rename({ extname: '.min.css' }))
    .pipe(dest(option.dist));
}

const build_example_assets = () => {
  return  src('src/example/**/*.?(png|jpg|gif|js)', { base: option.base })
    .pipe(dest(option.dist))
    .pipe(bs.reload({ stream: true }));
}

const build_example_style = () => {
  return src('src/example/**/*.less', { base: option.base })
  .pipe(
    less().on('error', function(e) {
      this.emit('end');
    })
  )
  .pipe(postcss([autoprefixer(['iOS >= 7', 'Android >= 4.1'])]))
  .pipe(
    nano({
      zindex: false,
      autoprefixer: false,
    })
  )
  .pipe(dest(option.dist))
  .pipe(bs.reload({ stream: true }));
}

const build_example_html = () => {
  return src('src/example/index.html', { base: option.base })
  .pipe(
    tap(function(file) {
      var dir = path.dirname(file.path);
      var contents = file.contents.toString();
      contents = contents.replace(
        /<link\s+rel="import"\s+href="(.*)">/gi,
        function(match, $1) {
          var filename = path.join(dir, $1);
          var id = path.basename(filename, '.html');
          var content = fs.readFileSync(filename, 'utf-8');
          return (
            '<script type="text/html" id="tpl_' +
            id +
            '">\n' +
            content +
            '\n</script>'
          );
        },
      );
      file.contents = Buffer.from(contents);
    }),
  )
  .pipe(dest(option.dist))
  .pipe(bs.reload({ stream: true }));
}

const serve = () => {
  watch('src/style/**/*', build_style)
  watch('src/example/example.less', build_example_style)
  watch('src/example/**/*.?(png|jpg|gif|js)', build_example_assets)
  watch('src/**/*.html', build_example_html)

  watch([
    'src/example/assets/images/**',
    'src/example/assets/fonts/**'
  ], bs.reload)

  yargs.p = yargs.p || 8080;

  bs.init({
    notify: true,
    port: yargs.p,
    // open: false,
    // files: 'dist/**',
    ui: {
      port: yargs.p + 1,
      weinre: {
          port: yargs.p + 2,
      },
    },
    server: {
      baseDir: './dist'
      // baseDir: ['temp', 'src', 'public'],
      // routes: {
      //   '/node_modules': 'node_modules'
      // }
    }
  })
}

const build_example = parallel(build_example_assets, build_example_style, build_example_html)

const build = series(clean, build_style, build_example)

const develop = series(build, serve)

module.exports = {
  ['build:style']: build_style,
  ['build:example']: build_example,
  build,
  develop
}
