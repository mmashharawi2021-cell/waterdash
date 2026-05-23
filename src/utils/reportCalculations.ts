// Utility functions for automatic calculations in water reports

/**
 * حساب عدد ساعات تشغيل المولد
 * @param startTime - وقت البداية بصيغة HH:mm
 * @param stopTime - وقت الإيقاف بصيغة HH:mm
 * @returns عدد الساعات
 */
export const calculateOperatingHours = (startTime: string, stopTime: string): number => {
  if (!startTime || !stopTime) return 0;

  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [stopHour, stopMinute] = stopTime.split(':').map(Number);

  let startTotalMinutes = startHour * 60 + startMinute;
  let stopTotalMinutes = stopHour * 60 + stopMinute;

  // إذا كان وقت الإيقاف أقل من وقت البداية، نفترض أنه في اليوم التالي
  if (stopTotalMinutes < startTotalMinutes) {
    stopTotalMinutes += 24 * 60;
  }

  const totalMinutes = stopTotalMinutes - startTotalMinutes;
  return parseFloat((totalMinutes / 60).toFixed(2));
};

/**
 * حساب كمية السولار المستهلكة
 * @param operatingHours - عدد ساعات التشغيل
 * @param fuelConsumptionPerHour - استهلاك السولار في الساعة (لتر/ساعة)
 * @returns كمية السولار المستهلكة
 */
export const calculateFuelConsumed = (
  operatingHours: number,
  fuelConsumptionPerHour: number
): number => {
  return parseFloat((operatingHours * fuelConsumptionPerHour).toFixed(2));
};

/**
 * حساب رصيد السولار المتبقي
 * @param previousBalance - الرصيد السابق
 * @param fuelAdded - السولار المضاف اليوم
 * @param fuelConsumed - السولار المستهلك
 * @returns الرصيد المتبقي
 */
export const calculateRemainingFuel = (
  previousBalance: number,
  fuelAdded: number,
  fuelConsumed: number
): number => {
  return parseFloat((previousBalance + fuelAdded - fuelConsumed).toFixed(2));
};

/**
 * حساب إجمالي الإنتاج من الغاطس
 * @param pumpProductionPerHour - إنتاج الغاطس في الساعة (كوب/ساعة)
 * @param operatingHours - عدد ساعات التشغيل
 * @returns إجمالي الإنتاج
 */
export const calculateTotalPumpProduction = (
  pumpProductionPerHour: number,
  operatingHours: number
): number => {
  return parseFloat((pumpProductionPerHour * operatingHours).toFixed(2));
};

/**
 * حساب كمية المياه المحلاة
 * المياه المحلاة = إجمالي الإنتاج - كمية المياه العادمة
 * @param totalProduction - إجمالي إنتاج الغاطس
 * @param wasteWater - كمية المياه العادمة
 * @returns كمية المياه المحلاة
 */
export const calculateDesaltedWater = (
  totalProduction: number,
  wasteWater: number
): number => {
  return parseFloat((totalProduction - wasteWater).toFixed(2));
};

/**
 * حساب كمية المياه العادمة
 * المياه العادمة = إجمالي الإنتاج - المياه المحلاة
 * @param totalProduction - إجمالي إنتاج الغاطس
 * @param desaltedWater - كمية المياه المحلاة
 * @returns كمية المياه العادمة
 */
export const calculateWasteWater = (
  totalProduction: number,
  desaltedWater: number
): number => {
  return parseFloat((totalProduction - desaltedWater).toFixed(2));
};

/**
 * التحقق من توازن المياه
 * إجمالي الإنتاج يجب أن يساوي المحلاة + العادمة
 * @param totalProduction - إجمالي الإنتاج
 * @param desaltedWater - المياه المحلاة
 * @param wasteWater - المياه العادمة
 * @returns true إذا كانت القيم متوازنة
 */
export const validateWaterBalance = (
  totalProduction: number,
  desaltedWater: number,
  wasteWater: number
): boolean => {
  const balance = parseFloat((desaltedWater + wasteWater).toFixed(2));
  return balance === totalProduction;
};
