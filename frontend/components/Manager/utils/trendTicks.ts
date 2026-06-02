const getTrendTickIndexes = (dayCount: number) => {
  if (dayCount <= 0) return [];
  const last = dayCount - 1;
  const step = dayCount > 14 ? Math.ceil(dayCount / 8) : 2;
  return Array.from({ length: dayCount }, (_, index) => index).filter(
    (index) => index === 0 || index === last || (index % step === 0 && last - index >= step),
  );
};

export default getTrendTickIndexes;
export { getTrendTickIndexes };
