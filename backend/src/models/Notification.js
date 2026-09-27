'use strict';

const mongoose = require('mongoose');
const toJSON = require('./plugins/toJSON');

const TYPES = [
  'plan_assigned',
  'plan_updated',
  'session_reminder',
  'media_approved',
  'media_rejected',
  'client_progress',
  'new_client',
  'content_updated',
  'message',
  'generic',
];

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    body: { type: String },
    type: { type: String, enum: TYPES, default: 'generic', index: true },
    data: { type: mongoose.Schema.Types.Mixed },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    deliveredPush: { type: Boolean, default: false },
    icon: { type: String },
    deepLink: { type: String },
  },
  { timestamps: true }
);

notificationSchema.plugin(toJSON);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

notificationSchema.statics.TYPES = TYPES;

notificationSchema.statics.unreadCount = function unreadCount(userId) {
  return this.countDocuments({ userId, read: false });
};

module.exports =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
