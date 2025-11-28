// Ленивая загрузка ES модуля
let referralCodesModule: any = null;

async function loadReferralCodes() {
  if (!referralCodesModule) {
    referralCodesModule = await import('referral-codes');
  }
  return referralCodesModule;
}

export default async function generateCode(length: number): Promise<string> {
  const referralCodes = await loadReferralCodes();
  return referralCodes.generate({
    length: length,
    count: 1,
    charset: referralCodes.charset(referralCodes.Charset.ALPHANUMERIC),
  })[0];
}
