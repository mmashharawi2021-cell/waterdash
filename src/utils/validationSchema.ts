import { z } from 'zod';

// Time difference calculator with midnight crossing support
export function calculateHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  
  let startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60; // crossed midnight
  }
  
  const diff = endMinutes - startMinutes;
  return parseFloat((diff / 60).toFixed(4));
}

// Single beneficiary row validation
export const beneficiaryValidationSchema = z.object({
  agencyName: z.string().min(1, "اسم الجهة المستفيدة مطلوب"),
  quantity: z.number({ message: "يجب إدخال كمية صحيحة كأرقام" }).min(0, "الكمية الموزعة لا يمكن أن تكون سالبة"),
  numberOfCars: z.number({ message: "يجب إدخال عدد السيارات كأرقام" }).int("يجب إدخال عدد سيارات صحيح").min(0, "عدد السيارات لا يمكن أن يكون سالباً")
});

// Comprehensive Daily Water Report Validation Schema
export const reportValidationSchema = z.object({
  date: z.string().refine((val) => {
    const selected = new Date(val);
    const today = new Date();
    // Reset hours to check just dates
    selected.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    return selected <= today;
  }, { message: "تاريخ التقرير لا يمكن أن يكون في المستقبل" }),
  
  stationName: z.string().min(1, "اسم محطة المياه مطلوب"),
  
  generator: z.object({
    startTime: z.string().min(1, "وقت بدء التشغيل مطلوب"),
    endTime: z.string().min(1, "وقت الإيقاف مطلوب")
  }),
  
  fuel: z.object({
    addedFuel: z.number({ message: "يجب إدخال كمية صحيحة" }).min(0, "السولار المضاف لا يمكن أن يكون سالباً").max(2000, "السعة القصوى للخزان هي 2000 لتر"),
    consumedFuel: z.number({ message: "يجب إدخال كمية صحيحة" }).min(0, "السولار المستهلك لا يمكن أن يكون سالباً"),
    suppliedFromMunicipality: z.number({ message: "يجب إدخال كمية صحيحة" }).min(0, "الكمية الموردة لا يمكن أن تكون سالبة")
  }),
  
  labTests: z.object({
    phDesalination: z.number({ message: "يجب إدخال رقم" }).min(0, "قيمة PH يجب أن تكون بين 0 و 14").max(14, "قيمة PH يجب أن تكون بين 0 و 14"),
    phSubmersible: z.number({ message: "يجب إدخال رقم" }).min(0, "قيمة PH يجب أن تكون بين 0 و 14").max(14, "قيمة PH يجب أن تكون بين 0 و 14"),
    tdsDesalinated: z.number({ message: "يجب إدخال رقم" }).min(0, "قيمة الملوحة لا يمكن أن تكون سالبة"),
    tdsWell: z.number({ message: "يجب إدخال رقم" }).min(0, "قيمة الملوحة لا يمكن أن تكون سالبة"),
    tdsWaste: z.number({ message: "يجب إدخال رقم" }).min(0, "قيمة الملوحة لا يمكن أن تكون سالبة"),
    freeChlorine: z.number({ message: "يجب إدخال رقم" }).min(0, "الكلور الحر لا يمكن أن يكون سالباً")
  }),
  
  beneficiaries: z.array(beneficiaryValidationSchema).min(1, "يجب تحديد جهة مستفيدة واحدة على الأقل")
}).superRefine((data, ctx) => {
  // 1. Operating Hours validation
  const hours = calculateHours(data.generator.startTime, data.generator.endTime);
  if (hours <= 0 || hours > 24) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['generator', 'endTime'],
      message: "ساعات التشغيل غير منطقية (يجب أن تكون أكبر من 0 ولا تتعدى 24 ساعة)"
    });
  }
});
