const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  userAgent: String,
  ipAddress: String,
  isRevoked: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ user: 1, isRevoked: 1 });

refreshTokenSchema.statics.createToken = async function(user, userAgent, ipAddress) {
  const crypto = require('crypto');
  const token = crypto.randomBytes(64).toString('hex');
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  
  await this.create({
    token,
    user: user._id,
    expiresAt,
    userAgent,
    ipAddress
  });
  
  return token;
};

refreshTokenSchema.statics.revokeToken = async function(token) {
  return this.updateOne({ token }, { isRevoked: true });
};

refreshTokenSchema.statics.revokeAllUserTokens = async function(userId) {
  return this.updateMany({ user: userId }, { isRevoked: true });
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
