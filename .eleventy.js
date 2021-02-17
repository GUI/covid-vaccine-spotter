module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy('.nojekyll');
  eleventyConfig.addPassthroughCopy('CNAME');
  eleventyConfig.addPassthroughCopy('site/_data');

  eleventyConfig.setEjsOptions({
    context: {
      lodash: require('lodash'),
      luxon: require('luxon'),
    },
  });

  return {
    dir: {
      input: 'site',
    },
  };
}
