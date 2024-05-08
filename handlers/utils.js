// 
// rule * * * * *
// minute(0-59) hour(0-23) date(month 1-31) month(0-11) day(week 0-6)
// eg. "*/2 10-20 * * 1-5"
// 
export const simpleCheckCronExpression = (rule, value) => {
  if (rule === "*") return true;
  if (rule.includes("/")) {
    let dividend = Number(rule.split("/")[1]);
    return (Number(value) % dividend === 0);
  }
  else {
    let slices = rule.split(",");
    for (let slice of slices) {
      if (slice.includes("-")) {
        let [min, max] = slice.split("-");
        if (value >= min && value <= max) return true;
      }
      else if (value === slice) return true;
    }
    return false;
  }
};

export const getEndofInterval = (rule, value, maxVal) => {
  if (rule === "*") return maxVal;
  if (rule.includes("/")) {
    let dividend = Number(rule.split("/")[1]);
    return (Number(value) % dividend === 0? value : maxVal);
  }
  else {
    let slices = rule.split(",");
    for (let slice of slices) {
      if (slice.includes("-")) {
        let [min, max] = slice.split("-");
        if (value >= min && value <= max) return max;
      }
      else if (value === slice) return value;
    }
    return maxVal;
  }
};
