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

const express = require('express');
const webAuth = require('../../middlewares/webAuth');
const validate = require('../../middlewares/validate');

const UserValidation = require('../../validations/user.validation');
const ChatRoomValidation = require('../../validations/chat.room.validation');
const OrdersValidation = require('../../validations/orders.validation');
const DiningBookingValidation = require('../../validations/dining.booking.validation');
const UserPurchasedTiffinSubscriptionValidation = require('../../validations/user.purchased.tiffin.subscriptions.validation');
const RestaurantValidation = require('../../validations/restaurant.validation');

const UserController = require('../../controllers/user.controller');
const SupportChatRoomController = require('../../controllers/support.chat.room.controller');
const SupportAssignmentController = require('../../controllers/support.assignment.controller');
const CannedResponseController = require('../../controllers/canned.response.controller');
const OrdersController = require('../../controllers/orders.controller');
const DiningBookingController = require('../../controllers/dining.booking.controller');
const UserPurchasedTiffinSubscriptionController = require('../../controllers/user.purchased.tiffin.subscription.controller');
const RestaurantController = require('../../controllers/restaurant.controller');
const CityController = require('../../controllers/city.controller');
const DriverController = require('../../controllers/driver.controller');
const NotificationListController = require('../../controllers/notification.list.controller');

const router = express.Router();

router.get(
  '/web_guard/:id',
  webAuth('web_guard'),
  validate(UserValidation.webGuardValidation),
  UserController.supportTeamProfile
);

router.get('/dashboard', webAuth('support_chats'), SupportChatRoomController.filterChatList);
router.post(
  '/chat_message_initial',
  webAuth('support_chats'),
  validate(ChatRoomValidation.supportChatValidation),
  SupportChatRoomController.getInitialChatSupportMessages
);
router.post(
  '/fetche_more_result',
  webAuth('support_chats'),
  validate(ChatRoomValidation.supportChatValidation),
  SupportChatRoomController.fetchMoreSupportMessages
);
router.post(
  '/chat/send/',
  webAuth('support_chats'),
  validate(ChatRoomValidation.sendChatMessageValidation),
  SupportChatRoomController.saveSupportMessage
);
router.post(
  '/bot/message',
  webAuth('support_chats'),
  SupportChatRoomController.botMessage
);

// ---- Auto-assignment (Phase B, spec 18.5) ----
router.post('/route_chat', webAuth('support_chats'), SupportAssignmentController.routeChat);
router.post('/claim_chat', webAuth('support_chats'), SupportAssignmentController.claimChat);
router.post('/reassign_chat', webAuth('reassign_support_chat'), SupportAssignmentController.reassignChat);
router.post('/take_ownership', webAuth('take_ownership_support_chat'), SupportAssignmentController.takeOwnership);
router.post('/unassign_chat', webAuth('unassign_support_chat'), SupportAssignmentController.unassignChat);
router.post('/drain_queue', webAuth('reassign_support_chat'), SupportAssignmentController.drainQueue);
router.get('/agent_badge_count/:agentId', webAuth('support_chats'), SupportAssignmentController.agentBadgeCount);
router.get('/unassigned_list', webAuth('support_chats'), SupportAssignmentController.unassignedList);
router.get('/agent_status/:agentId', webAuth('support_team_profile'), SupportAssignmentController.getAgentStatus);
router.put('/agent_status/:agentId', webAuth('manage_agent_status'), SupportAssignmentController.updateAgentStatus);
router.get('/my_agent_status', webAuth('support_team_profile'), SupportAssignmentController.getMyAgentStatus);
router.put('/my_agent_status', webAuth('support_team_profile'), SupportAssignmentController.updateMyAgentStatus);
router.post('/set_priority', webAuth('set_support_priority'), SupportAssignmentController.setPriority);
router.get('/manager_workload', webAuth('manage_agent_status'), SupportAssignmentController.managerWorkload);
router.get(
  '/order_detail/:id',
  webAuth('order_detail'),
  validate(OrdersValidation.orderDetailSupportTeamValidation),
  OrdersController.supportTeamOrderDetail
);
router.get(
  '/booking_detail/:bookingId',
  webAuth('booking_detail'),
  validate(DiningBookingValidation.supportTeamDiningValidation),
  DiningBookingController.supportTeamBookingDetail
);
router.get(
  '/purchase_detail/:id',
  webAuth('purchase_detail'),
  validate(UserPurchasedTiffinSubscriptionValidation.supportTeamPurchaseDetailValidation),
  UserPurchasedTiffinSubscriptionController.supportTeamPurchaseDetail
);
router.post(
  '/resolve_support_chat',
  webAuth('support_chats'),
  validate(ChatRoomValidation.resolveSupportChatValidation),
  SupportChatRoomController.resolveSupportChat
);
router.get(
  '/export_chats/:id',
  webAuth('support_chats'),
  validate(ChatRoomValidation.exportSupportChatValidation),
  SupportChatRoomController.exportSupportChat
);
router.get(
  '/support_team_chat_list/:id',
  webAuth('support_chats'),
  validate(ChatRoomValidation.supportTeamChatValidation),
  SupportChatRoomController.supportTeamChat
);
router.get('/customer_list', webAuth('customer_list'), UserController.customerList);
router.get(
  '/customer_detail/:id',
  webAuth('customer_list'),
  validate(UserValidation.supportTeamCustomerDetailValidation),
  UserController.supportTeamCustomerDetail
);
router.get(
  '/restaurant_initial',
  webAuth('restaurant_list'),
  RestaurantController.restauratReportInitialFilter
);
router.get(
  '/restaurant_list',
  webAuth('restaurant_list'),
  RestaurantController.supportTeamRestaurantList
);
router.get(
  '/restaurant_detail/:id',
  webAuth('restaurant_list'),
  validate(RestaurantValidation.supportTeamRestaurantValidation),
  RestaurantController.supportTeamRestaurantDetail
);

router.get('/all_cities', webAuth('cities_list'), CityController.getAll);
router.get(
  '/deliveryman_list',
  webAuth('deliveryman_list'),
  DriverController.supportTeamDeliverymanList
);

router.get(
  '/support_team_profile/:id',
  webAuth('support_team_profile'),
  validate(UserValidation.supportTeamProfileValidation),
  UserController.getSupportTeamProfile
);
router.patch(
  '/update_support_team/:id',
  webAuth('update_support_team'),
  validate(UserValidation.updateSupportTeamProfileValidation),
  UserController.updateSupportTeamProfile
);
router.patch(
  '/update_support_team_password/:id',
  webAuth('update_support_team_password'),
  validate(UserValidation.updateSupportTeamPasswordValidation),
  UserController.updateSupportTeamPassword
);

router.get(
  '/support_team_header_content/:id',
  webAuth('support_team_header_content'),
  validate(UserValidation.supportTeamHeaderValidation),
  NotificationListController.supportTeamHeaderContent
);

// ---- Canned responses (spec 18.4, 18.5) ----
router.post(
  '/canned_responses',
  webAuth('support_chats'),
  CannedResponseController.createCannedResponse
);
router.get(
  '/canned_responses',
  webAuth('support_chats'),
  CannedResponseController.listCannedResponses
);
router.get(
  '/canned_responses/:id',
  webAuth('support_chats'),
  CannedResponseController.getCannedResponse
);
router.put(
  '/canned_responses/:id',
  webAuth('support_chats'),
  CannedResponseController.updateCannedResponse
);
router.delete(
  '/canned_responses/:id',
  webAuth('support_chats'),
  CannedResponseController.deleteCannedResponse
);

router.get(
  '/agent_performance',
  webAuth('support_chats'),
  SupportAssignmentController.agentPerformance
);

router.get(
  '/transfer_history',
  webAuth('support_chats'),
  SupportAssignmentController.transferHistory
);

router.post(
  '/internal_note',
  webAuth('support_chats'),
  SupportChatRoomController.addInternalNote
);

router.post(
  '/add_tag',
  webAuth('support_chats'),
  SupportChatRoomController.addTag
);

router.post(
  '/remove_tag',
  webAuth('support_chats'),
  SupportChatRoomController.removeTag
);

router.post(
  '/snooze_chat',
  webAuth('support_chats'),
  SupportAssignmentController.snoozeChat
);

router.get(
  '/escalation_queue',
  webAuth('support_chats'),
  SupportAssignmentController.escalationQueue
);

router.post(
  '/set_sla_target',
  webAuth('manage_sla_config'),
  SupportAssignmentController.setSlaTarget
);

router.post(
  '/trigger_sla_check',
  webAuth('manage_sla_config'),
  SupportAssignmentController.triggerSlaCheck
);

router.get(
  '/config',
  webAuth('manage_sla_config'),
  SupportAssignmentController.getConfig
);

router.put(
  '/config',
  webAuth('manage_sla_config'),
  SupportAssignmentController.updateConfig
);

router.post(
  '/run_automation',
  webAuth('manage_sla_config'),
  SupportAssignmentController.runAutomation
);

router.post(
  '/bulk_assign',
  webAuth('support_chats'),
  SupportAssignmentController.bulkAssign
);

router.post(
  '/bulk_close',
  webAuth('support_chats'),
  SupportAssignmentController.bulkClose
);

router.post(
  '/bulk_tag',
  webAuth('support_chats'),
  SupportAssignmentController.bulkTag
);

router.post(
  '/join_chat',
  webAuth('support_chats'),
  SupportAssignmentController.joinChat
);

module.exports = router;

