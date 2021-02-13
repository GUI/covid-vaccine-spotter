module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy('CNAME');

  eleventyConfig.setEjsOptions({
    context: {
      lodash: require('lodash'),
    },
  });
}
