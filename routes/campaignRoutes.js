const express = require("express");
const router = express.Router();
const campaignController = require("../controller/campaign.controller"); // adjust path

router.post("/", campaignController.createCampaign);
router.get("/", campaignController.getAllCampaigns);
router.get("/:id", campaignController.getCampaignById);
router.put("/:id", campaignController.updateCampaign);
router.delete("/:id", campaignController.deleteCampaign);

module.exports = router;
