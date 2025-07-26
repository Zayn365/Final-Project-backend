const Campaign = require("../models/Campaign");

// CREATE
exports.createCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.create(req.body);

    if (!campaign) {
      return res.status(404).json("Not Created");
    }

    // Fetch and return all campaigns after update
    const campaigns = await Campaign.find();
    return res.status(200).json(campaigns);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// READ ALL
exports.getAllCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find();
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// READ ONE
exports.getCampaignById = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json("Not found");
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// UPDATE
exports.updateCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!campaign) {
      return res.status(404).json("Kampanya bulunamadı");
    }

    // Fetch and return all campaigns after update
    const campaigns = await Campaign.find();
    return res.status(200).json(campaigns);
  } catch (err) {
    console.error("Update Error:", err);
    return res.status(500).json({ message: "Sunucu hatası: " + err.message });
  }
};

// DELETE
exports.deleteCampaign = async (req, res) => {
  try {
    const result = await Campaign.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json("Not found");
    const campaign = await Campaign.find();
    res.status(200).json(campaign);
    res.json({ message: "Campaign deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
