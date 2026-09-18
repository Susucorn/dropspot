export function filterValidBins(bins) {
  return bins.filter((item) => {
    const lat = parseFloat(item.위도);
    const lng = parseFloat(item.경도);
    return !isNaN(lat) && !isNaN(lng);
  });
}