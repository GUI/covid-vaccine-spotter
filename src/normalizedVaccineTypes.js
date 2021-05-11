module.exports = (type) => {
  const normalized = [];

  if (type) {
    if (type.match(/(johnson|j *& *j|janssen)/i)) {
      normalized.push("jj");
    }

    if (type.match(/moderna/i)) {
      normalized.push("moderna");
    }

    if (type.match(/pfizer/i)) {
      normalized.push("pfizer");
    }
  }

  return normalized;
};
