export const BaseMailerRegistryABI = [
  'function registerEmail(string basename) returns (string)',
  'function resolveEmail(string email) view returns (address)',
  'function isEmailRegistered(string email) view returns (bool)',
  'function emailOwner(string email) view returns (address)'
] as const;

export const NameBasedMailerABI = [
  'event MailSent(uint256 indexed mailId, string indexed recipientEmail, string indexed senderEmail, bytes32 contentCID, uint256 timestamp)',
  'function sendMail(bytes proof, bytes32 contentCID, string senderEmail, string recipientEmail) returns (uint256)',
  'function getInbox(string email) view returns (tuple(bytes32 contentCID, string senderEmail, string recipientEmail, uint256 timestamp, bool verified)[])',
  'function getSentbox(string email) view returns (tuple(bytes32 contentCID, string senderEmail, string recipientEmail, uint256 timestamp, bool verified)[])',
  'function getMail(uint256 mailId) view returns (tuple(bytes32 contentCID, string senderEmail, string recipientEmail, uint256 timestamp, bool verified))'
] as const;
