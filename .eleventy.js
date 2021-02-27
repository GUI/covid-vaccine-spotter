module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy('.nojekyll');
  eleventyConfig.addPassthroughCopy('CNAME');
  eleventyConfig.addPassthroughCopy('site/api/v0');

  eleventyConfig.setEjsOptions({
    context: {
      lodash: require('lodash'),
      listify: require('listify'),
      luxon: require('luxon'),
    },
  });

  return {
    dir: {
      input: 'site',
      data: 'api/v0',
    },
  };
};
