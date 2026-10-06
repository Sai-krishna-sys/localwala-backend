/**
 * LocalWala – Local Commerce & Delivery Platform
 * (NodeJS, MongoDB, Angular & Flutter)
 *
 * Copyright © 2026 WeWorkLocal Private Limited
 * https://weworklocal.in/
 *
 * WeWorkLocal Private Limited
 *
 * This source code is confidential.
 * Unauthorized copying, redistribution, resale, publication,
 * modification, or use of this source code in any public or
 * commercial repository is strictly prohibited.
 *
 * Ownership Fingerprint:
 * LWL|WWL|2026|LOCALWALA|NODE
 */

const { status: httpStatus } = require('http-status');
const mongoose = require('mongoose');
const {
  SupportChatRoom,
  User,
  Orders,
  DiningBooking,
  UserPurchasedTiffinSubscription,
  Complaints,
  ReportIssueRestaurant,
  Restaurant,
  RestaurantComplaints,
  SupportChatConversion,
} = require('../models');
const supportChatConversionService = require('./support.chat.conversion.service');
const supportBotService = require('./support.bot.service');
const ApiError = require('../utils/ApiError');
const checkArrayNotEmpty = require('../utils/arrayNotEmpty');

const checkChatRoom = async (user, type, typeId, options) => {
  const condition = {
    userId: new mongoose.Types.ObjectId(user),
    supportType: type,
    orders: type === 'orders' ? new mongoose.Types.ObjectId(typeId) : null,
    booking: type === 'dining' ? new mongoose.Types.ObjectId(typeId) : null,
    purchaseSubscription:
      type === 'tiffin_subscription' ? new mongoose.Types.ObjectId(typeId) : null,
    complaints: type === 'complaints' ? new mongoose.Types.ObjectId(typeId) : null,
    reportIssue: type === 'reports' ? new mongoose.Types.ObjectId(typeId) : null,
    restaurantComplaints:
      type === 'restaurant_complaints' ? new mongoose.Types.ObjectId(typeId) : null,
  };
  let chatRoom = await SupportChatRoom.findOne(condition);
  let isNewRoom = false;
  if (!chatRoom) {
    const chatParam = {
      userId: new mongoose.Types.ObjectId(user),
      supportTeam: [],
      orders: type === 'orders' ? new mongoose.Types.ObjectId(typeId) : null,
      booking: type === 'dining' ? new mongoose.Types.ObjectId(typeId) : null,
      purchaseSubscription:
        type === 'tiffin_subscription' ? new mongoose.Types.ObjectId(typeId) : null,
      complaints: type === 'complaints' ? new mongoose.Types.ObjectId(typeId) : null,
      reportIssue: type === 'reports' ? new mongoose.Types.ObjectId(typeId) : null,
      restaurantComplaints:
        type === 'restaurant_complaints' ? new mongoose.Types.ObjectId(typeId) : null,
      supportType: type,
      lastMessage: '',
      lastMessageType: 'text',
    };
    chatRoom = new SupportChatRoom(chatParam);
    await chatRoom.save();
    isNewRoom = true;
  }
  if (chatRoom && chatRoom !== null && chatRoom.id) {
    const roomId = chatRoom.id;

    // Send bot greeting with quick replies on new room creation
    if (isNewRoom) {
      try {
        const quickReplies = supportBotService.getQuickRepliesForSupportType(type);
        const greetingPayload = {
          text: 'Hi! How can I help you today?',
          quickReplies,
        };
        await supportBotService.writeBotReply(roomId, greetingPayload);
      } catch (botError) {
        console.error('support.chat.room bot greeting error:', botError);
      }
    }

    const chats = supportChatConversionService.getMessages(roomId, options);
    return chats;
  }
  return { success: false };
};

const mySupportChat = async (userID) => {
  const chatListQuery = [
    {
      $match: { userId: new mongoose.Types.ObjectId(userID) },
    },
    { $sort: { updatedAt: -1 } },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'users',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'supportTeam',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 0,
              id: '$_id',
              firstName: 1,
              lastName: 1,
              image: 1,
            },
          },
          { $limit: 3 },
        ],
        as: 'team',
      },
    },
    {
      $unwind: {
        path: '$users',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        id: '$_id',
        supportType: 1,
        updatedAt: 1,
        lastMessage: 1,
        lastMessageType: 1,
        orders: 1,
        booking: 1,
        purchaseSubscription: 1,
        restaurantComplaints: 1,
        complaints: 1,
        reportIssue: 1,
        status: 1,
        team: 1,
        customer: {
          id: { $ifNull: ['$users._id', ''] },
          image: { $ifNull: ['$users.image', ''] },
          firstName: { $ifNull: ['$users.firstName', ''] },
          lastName: { $ifNull: ['$users.lastName', ''] },
        },
      },
    },
  ];
  const chatList = await SupportChatRoom.aggregate(chatListQuery);
  return Promise.all([chatList]).then(() => {
    const result = {
      chats: chatList,
      success: true,
    };
    return Promise.resolve(result);
  });
};

const filterChatList = async (options) => {
  const limit = options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 10;
  const page = options.page && parseInt(options.page, 10) > 0 ? parseInt(options.page, 10) : 1;
  const skip = (page - 1) * limit;
  let queryCondition = {};
  if (options.filter !== 'all') {
    queryCondition = { status: options.filter };
  } else {
    queryCondition = { status: { $ne: 'all' } };
  }
  const supportQuery = [
    { $match: queryCondition },
    { $sort: { updatedAt: -1 } },
    { $skip: skip },
    { $limit: Number(limit) },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'users',
        pipeline: [
          {
            $addFields: {
              contactNumber: {
                $concat: [
                  { $substr: ['$mobile', 0, 2] },
                  'XXXXXX',
                  { $substr: ['$mobile', { $subtract: [{ $strLenCP: '$mobile' }, 2] }, 2] },
                ],
              },
              contactEmail: {
                $concat: [
                  { $substrCP: ['$email', 0, 2] },
                  'XXXXX@',
                  { $arrayElemAt: [{ $split: ['$email', '@'] }, 1] },
                ],
              },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'supportTeam',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 0,
              id: '$_id',
              firstName: 1,
              lastName: 1,
              image: 1,
            },
          },
          { $limit: 3 },
        ],
        as: 'team',
      },
    },
    {
      $unwind: {
        path: '$users',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        id: '$_id',
        orders: 1,
        booking: 1,
        purchaseSubscription: 1,
        complaints: 1,
        reportIssue: 1,
        supportType: 1,
        restaurantComplaints: 1,
        status: 1,
        updatedAt: 1,
        customer: {
          id: { $ifNull: ['$users._id', ''] },
          image: { $ifNull: ['$users.image', ''] },
          firstName: { $ifNull: ['$users.firstName', ''] },
          lastName: { $ifNull: ['$users.lastName', ''] },
          contactEmail: { $ifNull: ['$users.contactEmail', ''] },
          countryCode: { $ifNull: ['$users.countryCode', ''] },
          contactNumber: { $ifNull: ['$users.contactNumber', ''] },
          role: { $ifNull: ['$users.role', ''] },
        },
        team: 1,
      },
    },
  ];
  const chats = await SupportChatRoom.aggregate(supportQuery);
  const totalResults = await SupportChatRoom.countDocuments(queryCondition);
  const allChat = await SupportChatRoom.countDocuments();
  const orderChat = await SupportChatRoom.countDocuments({ supportType: 'orders' });
  const diningChat = await SupportChatRoom.countDocuments({ supportType: 'dining' });
  const tiffinSubscriptionChat = await SupportChatRoom.countDocuments({
    supportType: 'tiffin_subscription',
  });
  const complaintChat = await SupportChatRoom.countDocuments({ supportType: 'complaints' });
  const reportChat = await SupportChatRoom.countDocuments({ supportType: 'reports' });
  const restaurantComplaintChats = await SupportChatRoom.countDocuments({
    supportType: 'restaurant_complaints',
  });
  const openChat = await SupportChatRoom.countDocuments({ status: 'open' });
  const inProgressChat = await SupportChatRoom.countDocuments({ status: 'in_progress' });
  const resolvedChat = await SupportChatRoom.countDocuments({ status: 'resolved' });

  return Promise.all([
    chats,
    totalResults,
    allChat,
    orderChat,
    diningChat,
    tiffinSubscriptionChat,
    complaintChat,
    reportChat,
    restaurantComplaintChats,
    openChat,
    inProgressChat,
    resolvedChat,
  ]).then(() => {
    const result = {
      chats,
      totalResults,
      allChat,
      diningChat,
      tiffinSubscriptionChat,
      complaintChat,
      reportChat,
      restaurantComplaintChats,
      orderChat,
      openChat,
      inProgressChat,
      resolvedChat,
      success: true,
    };
    return Promise.resolve(result);
  });
};

const getInitialChatSupportMessages = async (options) => {
  const info = await SupportChatRoom.findById(options.roomId, {
    userId: 1,
    supportType: 1,
    orders: 1,
    booking: 1,
    purchaseSubscription: 1,
    complaints: 1,
    reportIssue: 1,
    createdAt: 1,
    restaurantComplaints: 1,
  }).lean();
  if (!info) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }
  let orderInfo = null;
  let bookingInfo = null;
  let packageInfo = null;
  let complaintInfo = null;
  let reportInfo = null;
  let restaurantId = null;
  let restaurantComplaintInfo = null;

  if (info && info.supportType !== null && info.supportType === 'orders') {
    orderInfo = await Orders.findById(info.orders, {
      orderNo: 1,
      grandTotal: 1,
      orderTo: 1,
      status: 1,
      restaurant: 1,
    });
    if (orderInfo && orderInfo !== null && orderInfo.id !== null && orderInfo.id !== '') {
      restaurantId = orderInfo.restaurant;
    }
  }

  if (info && info.supportType !== null && info.supportType === 'dining') {
    bookingInfo = await DiningBooking.findById(info.booking, {
      grandTotal: 1,
      paymentMode: 1,
      status: 1,
      restaurant: 1,
    });
    if (bookingInfo && bookingInfo !== null && bookingInfo.id !== null && bookingInfo.id !== '') {
      restaurantId = bookingInfo.restaurant;
    }
  }

  if (info && info.supportType !== null && info.supportType === 'tiffin_subscription') {
    packageInfo = await UserPurchasedTiffinSubscription.findById(info.purchaseSubscription, {
      grandTotal: 1,
      totalOrder: 1,
      status: 1,
      restaurant: 1,
    });
    if (packageInfo && packageInfo !== null && packageInfo.id !== null && packageInfo.id !== '') {
      restaurantId = packageInfo.restaurant;
    }
  }

  if (info && info.supportType !== null && info.supportType === 'complaints') {
    const complaintDetail = await Complaints.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(info.complaints) } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'complaintsreasons',
          localField: 'reason',
          foreignField: '_id',
          as: 'reasons',
        },
      },
      {
        $unwind: {
          path: '$reasons',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          title: 1,
          brief: 1,
          status: 1,
          issueWith: 1,
          orders: 1,
          restaurant: 1,
          reasons: {
            id: { $ifNull: ['$reasons._id', ''] },
            name: { $ifNull: ['$reasons.name', ''] },
            translations: { $ifNull: ['$reasons.translations', []] },
          },
        },
      },
    ]);
    if (checkArrayNotEmpty(complaintDetail)) {
      complaintInfo = complaintDetail[0];
      if (
        complaintInfo &&
        complaintInfo !== null &&
        complaintInfo.id !== null &&
        complaintInfo.id !== ''
      ) {
        restaurantId = complaintInfo.restaurant;
      }
    }
  }

  if (info && info.supportType !== null && info.supportType === 'restaurant_complaints') {
    const complaintDetail = await RestaurantComplaints.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(info.restaurantComplaints) } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'complaintsreasons',
          localField: 'reason',
          foreignField: '_id',
          as: 'reasons',
        },
      },
      {
        $unwind: {
          path: '$reasons',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          title: 1,
          brief: 1,
          status: 1,
          issueWith: 1,
          orders: 1,
          restaurant: 1,
          reasons: {
            id: { $ifNull: ['$reasons._id', ''] },
            name: { $ifNull: ['$reasons.name', ''] },
            translations: { $ifNull: ['$reasons.translations', []] },
          },
        },
      },
    ]);
    if (checkArrayNotEmpty(complaintDetail)) {
      restaurantComplaintInfo = complaintDetail[0];
      if (
        restaurantComplaintInfo &&
        restaurantComplaintInfo !== null &&
        restaurantComplaintInfo.id !== null &&
        restaurantComplaintInfo.id !== ''
      ) {
        restaurantId = restaurantComplaintInfo.restaurant;
      }
    }
  }

  if (info && info.supportType !== null && info.supportType === 'reports') {
    const reportDetail = await ReportIssueRestaurant.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(info.reportIssue) } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'reportissuerestaurantreasons',
          localField: 'reason',
          foreignField: '_id',
          as: 'reasons',
        },
      },
      {
        $unwind: {
          path: '$reasons',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          message: 1,
          restaurant: 1,
          reasons: {
            id: { $ifNull: ['$reasons._id', ''] },
            name: { $ifNull: ['$reasons.name', ''] },
            translations: { $ifNull: ['$reasons.translations', []] },
          },
        },
      },
    ]);
    if (checkArrayNotEmpty(reportDetail)) {
      reportInfo = reportDetail[0];
      if (reportInfo && reportInfo !== null && reportInfo.id !== null && reportInfo.id !== '') {
        restaurantId = reportInfo.restaurant;
      }
    }
  }

  let restaurantInfo = null;

  if (restaurantId !== null && restaurantId !== '') {
    const restaurantDetail = await Restaurant.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(restaurantId) } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'users',
        },
      },
      {
        $unwind: {
          path: '$users',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          name: 1,
          cover: 1,
          address: 1,
          translations: 1,
          userInfo: {
            id: { $ifNull: ['$users._id', ''] },
            firstName: { $ifNull: ['$users.firstName', ''] },
            lastName: { $ifNull: ['$users.lastName', ''] },
            countryCode: { $ifNull: ['$users.countryCode', ''] },
            mobile: { $ifNull: ['$users.mobile', ''] },
            email: { $ifNull: ['$users.email', ''] },
            role: { $ifNull: ['$users.role', ''] },
          },
        },
      },
    ]);
    if (checkArrayNotEmpty(restaurantDetail)) {
      restaurantInfo = restaurantDetail[0];
    }
  }

  const userInfo = await User.findById(info.userId, {
    firstName: 1,
    lastName: 1,
    email: 1,
    role: 1,
    image: 1,
    countryCode: 1,
    mobile: 1,
  });
  const supportTeam = await User.findById(options.supportTeam, {
    firstName: 1,
    lastName: 1,
    image: 1,
  });
  const chats = await supportChatConversionService.getMessages(options.roomId, options);
  return Promise.all([
    info,
    orderInfo,
    bookingInfo,
    packageInfo,
    complaintInfo,
    restaurantComplaintInfo,
    reportInfo,
    restaurantInfo,
    userInfo,
    supportTeam,
    chats,
  ]).then(() => {
    const result = {
      info,
      orderInfo,
      bookingInfo,
      packageInfo,
      complaintInfo,
      restaurantComplaintInfo,
      reportInfo,
      restaurantInfo,
      userInfo,
      supportTeam,
      chats,
      success: true,
    };
    return Promise.resolve(result);
  });
};

const fetchMoreSupportMessages = async (options) => {
  const chats = await supportChatConversionService.getMessages(options.roomId, options);
  return { chats, success: true };
};

const resolveSupportChat = async (id, teamId) => {
  const detail = await SupportChatRoom.findById(id);
  if (!detail) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }
  Object.assign(detail, { status: 'resolved', resolvedBy: teamId });
  await detail.save();
  if (detail.supportType === 'complaints') {
    const complaintDetail = await Complaints.findById(detail.complaints);
    if (complaintDetail && complaintDetail !== null && complaintDetail.id !== null) {
      Object.assign(complaintDetail, { status: false });
      await complaintDetail.save();
    }
  }
  if (detail.supportType === 'reports') {
    const reportDetail = await ReportIssueRestaurant.findById(detail.reportIssue);
    if (reportDetail && reportDetail !== null && reportDetail.id !== null) {
      Object.assign(reportDetail, { status: false });
      await reportDetail.save();
    }
  }

  if (detail.supportType === 'restaurant_complaints') {
    const complaintDetail = await RestaurantComplaints.findById(detail.restaurantComplaints);
    if (complaintDetail && complaintDetail !== null && complaintDetail.id !== null) {
      Object.assign(complaintDetail, { status: false });
      await complaintDetail.save();
    }
  }
  return { success: true };
};

const supportTeamChat = async (teamId, options) => {
  const limit = options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 10;
  const page = options.page && parseInt(options.page, 10) > 0 ? parseInt(options.page, 10) : 1;
  const skip = (page - 1) * limit;
  const queryCondition = {
    supportTeam: { $in: [new mongoose.Types.ObjectId(teamId)] },
  };
  const supportQuery = [
    { $match: queryCondition },
    { $sort: { updatedAt: -1 } },
    { $skip: skip },
    { $limit: Number(limit) },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'users',
        pipeline: [
          {
            $addFields: {
              contactNumber: {
                $concat: [
                  { $substr: ['$mobile', 0, 2] },
                  'XXXXXX',
                  { $substr: ['$mobile', { $subtract: [{ $strLenCP: '$mobile' }, 2] }, 2] },
                ],
              },
              contactEmail: {
                $concat: [
                  { $substrCP: ['$email', 0, 2] },
                  'XXXXX@',
                  { $arrayElemAt: [{ $split: ['$email', '@'] }, 1] },
                ],
              },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'supportTeam',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 0,
              id: '$_id',
              firstName: 1,
              lastName: 1,
              image: 1,
            },
          },
          { $limit: 3 },
        ],
        as: 'team',
      },
    },
    {
      $unwind: {
        path: '$users',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        id: '$_id',
        orders: 1,
        booking: 1,
        purchaseSubscription: 1,
        complaints: 1,
        reportIssue: 1,
        supportType: 1,
        restaurantComplaints: 1,
        status: 1,
        updatedAt: 1,
        customer: {
          id: { $ifNull: ['$users._id', ''] },
          image: { $ifNull: ['$users.image', ''] },
          firstName: { $ifNull: ['$users.firstName', ''] },
          lastName: { $ifNull: ['$users.lastName', ''] },
          contactEmail: { $ifNull: ['$users.contactEmail', ''] },
          countryCode: { $ifNull: ['$users.countryCode', ''] },
          contactNumber: { $ifNull: ['$users.contactNumber', ''] },
          role: { $ifNull: ['$users.role', ''] },
        },
        team: 1,
        assignedTo: 1,
        assignedAt: 1,
        priority: 1,
        dueAt: 1,
        escalated: 1,
      },
    },
  ];
  const results = await SupportChatRoom.aggregate(supportQuery);
  const totalResults = await SupportChatRoom.countDocuments(queryCondition);
  return Promise.all([results, totalResults]).then(() => {
    const totalPages = Math.ceil(totalResults / limit);
    const result = {
      results,
      page,
      limit,
      totalPages,
      totalResults,
    };
    return Promise.resolve(result);
  });
};

const adminSupportChatList = async (options) => {
  const limit = options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 10;
  const page = options.page && parseInt(options.page, 10) > 0 ? parseInt(options.page, 10) : 1;
  const skip = (page - 1) * limit;
  const chatListQuery = [
    { $sort: { updatedAt: -1 } },
    { $skip: skip },
    { $limit: Number(limit) },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'users',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'supportTeam',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 0,
              id: '$_id',
              firstName: 1,
              lastName: 1,
              image: 1,
            },
          },
          { $limit: 3 },
        ],
        as: 'team',
      },
    },
    {
      $unwind: {
        path: '$users',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        id: '$_id',
        supportType: 1,
        updatedAt: 1,
        lastMessage: 1,
        lastMessageType: 1,
        orders: 1,
        booking: 1,
        purchaseSubscription: 1,
        restaurantComplaints: 1,
        complaints: 1,
        reportIssue: 1,
        status: 1,
        team: 1,
        customer: {
          id: { $ifNull: ['$users._id', ''] },
          image: { $ifNull: ['$users.image', ''] },
          firstName: { $ifNull: ['$users.firstName', ''] },
          lastName: { $ifNull: ['$users.lastName', ''] },
        },
      },
    },
  ];
  const results = await SupportChatRoom.aggregate(chatListQuery);
  const totalResults = await SupportChatRoom.countDocuments();
  return Promise.all([results, totalResults]).then(() => {
    const totalPages = Math.ceil(totalResults / limit);
    const result = {
      results,
      page,
      limit,
      totalPages,
      totalResults,
      success: true,
    };
    return Promise.resolve(result);
  });
};

const cityzenSupportChatList = async (masterId, options) => {
  const cityzen = await User.findById(masterId, { city: 1 });
  if (!cityzen) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }
  const { city } = cityzen;
  const limit = options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 10;
  const page = options.page && parseInt(options.page, 10) > 0 ? parseInt(options.page, 10) : 1;
  const skip = (page - 1) * limit;
  const chatListQuery = [
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'users',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'supportTeam',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 0,
              id: '$_id',
              firstName: 1,
              lastName: 1,
              image: 1,
            },
          },
          { $limit: 3 },
        ],
        as: 'team',
      },
    },
    {
      $unwind: {
        path: '$users',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        'users.city': new mongoose.Types.ObjectId(city),
      },
    },
    { $sort: { updatedAt: -1 } },
    { $skip: skip },
    { $limit: Number(limit) },
    {
      $project: {
        _id: 0,
        id: '$_id',
        supportType: 1,
        updatedAt: 1,
        lastMessage: 1,
        lastMessageType: 1,
        orders: 1,
        booking: 1,
        purchaseSubscription: 1,
        restaurantComplaints: 1,
        complaints: 1,
        reportIssue: 1,
        status: 1,
        team: 1,
        customer: {
          id: { $ifNull: ['$users._id', ''] },
          image: { $ifNull: ['$users.image', ''] },
          firstName: { $ifNull: ['$users.firstName', ''] },
          lastName: { $ifNull: ['$users.lastName', ''] },
        },
      },
    },
  ];
  const results = await SupportChatRoom.aggregate(chatListQuery);
  const totalResults = await SupportChatRoom.countDocuments();
  return Promise.all([cityzen, results, totalResults]).then(() => {
    const totalPages = Math.ceil(totalResults / limit);
    const result = {
      results,
      page,
      limit,
      totalPages,
      totalResults,
      success: true,
    };
    return Promise.resolve(result);
  });
};

const exportCollection = async () => {
  const query = [
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'users',
      },
    },
    {
      $unwind: {
        path: '$users',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        id: '$_id',
        supportType: 1,
        updatedAt: 1,
        lastMessage: 1,
        lastMessageType: 1,
        orders: 1,
        booking: 1,
        purchaseSubscription: 1,
        restaurantComplaints: 1,
        complaints: 1,
        reportIssue: 1,
        status: 1,
        team: 1,
        customer: {
          id: { $ifNull: ['$users._id', ''] },
          firstName: { $ifNull: ['$users.firstName', ''] },
          lastName: { $ifNull: ['$users.lastName', ''] },
        },
      },
    },
  ];
  const results = await SupportChatRoom.aggregate(query);
  return results;
};

const exportRawCollection = async () => {
  const results = await SupportChatRoom.find();
  return results;
};

const importChatListCollection = async (importArray) => {
  if (importArray !== null && checkArrayNotEmpty(importArray)) {
    importArray.forEach(async (param) => {
      let type = '';
      let typeId = '';
      const issueType = [
        'orders',
        'dining',
        'tiffin_subscription',
        'complaints',
        'reports',
        'restaurant_complaints',
      ];
      if (
        issueType.includes(param.supportType) &&
        param &&
        param.userId &&
        param.userId !== null &&
        param.userId !== ''
      ) {
        type = param.supportType;
        if (
          param.supportType === 'orders' &&
          param.orders &&
          param.orders !== null &&
          param.orders !== '' &&
          param.orders !== '-'
        ) {
          typeId = param.orders;
        }
        if (
          param.supportType === 'dining' &&
          param.booking &&
          param.booking !== null &&
          param.booking !== '' &&
          param.booking !== '-'
        ) {
          typeId = param.booking;
        }
        if (
          param.supportType === 'tiffin_subscription' &&
          param.purchaseSubscription &&
          param.purchaseSubscription !== null &&
          param.purchaseSubscription !== '' &&
          param.purchaseSubscription !== '-'
        ) {
          typeId = param.purchaseSubscription;
        }
        if (
          param.supportType === 'complaints' &&
          param.complaints &&
          param.complaints !== null &&
          param.complaints !== '' &&
          param.complaints !== '-'
        ) {
          typeId = param.complaints;
        }
        if (
          param.supportType === 'reports' &&
          param.reportIssue &&
          param.reportIssue !== null &&
          param.reportIssue !== '' &&
          param.reportIssue !== '-'
        ) {
          typeId = param.reportIssue;
        }
        if (
          param.supportType === 'restaurant_complaints' &&
          param.restaurantComplaints &&
          param.restaurantComplaints !== null &&
          param.restaurantComplaints !== '' &&
          param.restaurantComplaints !== '-'
        ) {
          typeId = param.restaurantComplaints;
        }
        const user = param.userId;
        const condition = {
          userId: new mongoose.Types.ObjectId(user),
          supportType: type,
          orders: type === 'orders' ? new mongoose.Types.ObjectId(typeId) : null,
          booking: type === 'dining' ? new mongoose.Types.ObjectId(typeId) : null,
          purchaseSubscription:
            type === 'tiffin_subscription' ? new mongoose.Types.ObjectId(typeId) : null,
          complaints: type === 'complaints' ? new mongoose.Types.ObjectId(typeId) : null,
          reportIssue: type === 'reports' ? new mongoose.Types.ObjectId(typeId) : null,
          restaurantComplaints:
            type === 'restaurant_complaints' ? new mongoose.Types.ObjectId(typeId) : null,
        };
        const chatRoom = await SupportChatRoom.findOne(condition);
        const supportTeamList =
          param &&
          param.supportTeam &&
          param.supportTeam !== null &&
          param.supportTeam !== '' &&
          param.supportTeam !== '-'
            ? param.supportTeam.split(',')
            : [];
        if (!chatRoom) {
          const chatRoomData = new SupportChatRoom({
            userId: new mongoose.Types.ObjectId(user),
            supportTeam: supportTeamList,
            orders: type === 'orders' ? new mongoose.Types.ObjectId(typeId) : null,
            booking: type === 'dining' ? new mongoose.Types.ObjectId(typeId) : null,
            purchaseSubscription:
              type === 'tiffin_subscription' ? new mongoose.Types.ObjectId(typeId) : null,
            complaints: type === 'complaints' ? new mongoose.Types.ObjectId(typeId) : null,
            reportIssue: type === 'reports' ? new mongoose.Types.ObjectId(typeId) : null,
            restaurantComplaints:
              type === 'restaurant_complaints' ? new mongoose.Types.ObjectId(typeId) : null,
            supportType: type,
            lastMessage:
              param && param.lastMessage && param.lastMessage !== null && param.lastMessage !== ''
                ? param.lastMessage
                : '',
            lastMessageType:
              param &&
              param.lastMessageType &&
              param.lastMessageType !== null &&
              param.lastMessageType !== '' &&
              param.lastMessageType === 'text'
                ? 'text'
                : 'image',
          });
          await SupportChatRoom.create(chatRoomData);
        }
      }
    });
  }
  return { success: true };
};

const importChatMessagesCollection = async (importArray) => {
  if (importArray !== null && checkArrayNotEmpty(importArray)) {
    const ops = importArray.map((messsage) => ({
      updateOne: {
        filter: { roomId: messsage.roomId },
        update: { $setOnInsert: messsage },
        upsert: true,
      },
    }));
    await SupportChatConversion.bulkWrite(ops);
  }
  return { success: true };
};

// C2: explicitly trigger the bot on a support chat (used by /bot/message endpoint).
// Guards: only surfaces the bot reply; skips if a human agent already owns the chat.
const triggerBot = async (room, sender, msg, supportType) => {
  const chatRoom = await SupportChatRoom.findById(room);
  if (!chatRoom) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Support chat not found');
  }
  if (chatRoom.assignedTo) {
    return { success: true, skipped: true, reason: 'already-assigned' };
  }
  return supportBotService.handleMessage({
    roomId: room,
    userId: sender,
    message: msg,
    supportType: supportType || chatRoom.supportType || 'orders',
  });
};

const submitCsat = async (chatRoomId, userId, rating, feedback) => {
  const chatRoom = await SupportChatRoom.findById(chatRoomId);
  if (!chatRoom) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Support chat not found');
  }
  if (chatRoom.userId.toString() !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You can only rate your own chat');
  }
  if (chatRoom.csatSubmittedAt) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'CSAT already submitted');
  }
  chatRoom.csatRating = rating;
  chatRoom.csatFeedback = feedback || undefined;
  chatRoom.csatSubmittedAt = new Date();
  await chatRoom.save();
  return { success: true, message: 'CSAT submitted successfully' };
};

const markResolved = async (chatRoomId, userId) => {
  const chatRoom = await SupportChatRoom.findById(chatRoomId);
  if (!chatRoom) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Support chat not found');
  }
  if (chatRoom.userId.toString() !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You can only resolve your own chat');
  }
  chatRoom.status = 'resolved';
  chatRoom.resolvedBy = userId;
  chatRoom.resolvedAt = new Date();
  await chatRoom.save();
  return { success: true, message: 'Chat resolved successfully' };
};

module.exports = {
  checkChatRoom,
  mySupportChat,
  filterChatList,
  getInitialChatSupportMessages,
  resolveSupportChat,
  supportTeamChat,
  adminSupportChatList,
  fetchMoreSupportMessages,
  cityzenSupportChatList,
  exportCollection,
  exportRawCollection,
  importChatListCollection,
  importChatMessagesCollection,
  triggerBot,
  submitCsat,
  markResolved,
};

