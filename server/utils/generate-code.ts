import * as referralCodes from 'referral-codes';
export default function generateCode(length: number) {
  return referralCodes.generate({
    length: length,
    count: 1,
    charset: referralCodes.charset(referralCodes.Charset.ALPHANUMERIC),
  })[0];
}
