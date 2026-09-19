const Job = require('../models/Job');
const Material = require('../models/Material');
const ragService = require('./ragService');

class JobWorker {
  constructor() {
    this.isRunning = false;
    this.pollInterval = 4000; // 4 seconds
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('✓ Background Job Worker started polling MongoDB jobs...');
    this.pollLoop();
  }

  stop() {
    this.isRunning = false;
  }

  async pollLoop() {
    while (this.isRunning) {
      try {
        // Only attempt to poll jobs if MongoDB is connected
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 1) {
          await this.processNextJob();
        }
      } catch (err) {
        console.error('Job Worker Loop Error:', err.message);
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
    }
  }

  async processNextJob() {
    // Atomically find one queued job and set it to processing
    const job = await Job.findOneAndUpdate(
      { status: 'queued', attempts: { $lt: 3 } },
      { $set: { status: 'processing', startedAt: new Date() }, $inc: { attempts: 1 } },
      { new: true }
    );

    if (!job) return; // No queued jobs

    console.log(`[Job Worker] Processing job ${job._id} (Type: ${job.type}, Material: ${job.materialId})`);

    try {
      if (job.type === 'ingest' || job.type === 'embed') {
        const material = await Material.findById(job.materialId);
        if (!material) {
          throw new Error(`Material with ID ${job.materialId} not found`);
        }

        // Update material state to processing
        material.status = 'processing';
        await material.save();

        // Call Python RAG ingestion endpoint
        const result = await ragService.ingestDocument({
          filePath: material.filePath,
          projectId: job.projectId,
          materialId: material._id,
          filename: material.originalName,
        });

        // Update material state to ready
        material.status = 'ready';
        material.chunkCount = result.chunks_count || 0;
        await material.save();

        // Complete job
        job.status = 'done';
        job.finishedAt = new Date();
        await job.save();

        console.log(`[Job Worker] Successfully completed job ${job._id} for material ${material.originalName}`);
      }
    } catch (error) {
      console.error(`[Job Worker] Job ${job._id} failed:`, error.message);
      job.status = job.attempts >= job.maxAttempts ? 'error' : 'queued';
      job.error = error.message;
      await job.save();

      if (job.materialId) {
        await Material.findByIdAndUpdate(job.materialId, {
          status: 'failed',
          errorMessage: error.message,
        });
      }
    }
  }
}

const workerInstance = new JobWorker();
module.exports = workerInstance;
