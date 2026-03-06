// test-embedding-batch.ts
// Quick test to see if batching fixes the timeout

import { defaultConfig } from "./rag/config";
import { EmbeddingFactory } from "./rag/embeddings/embedding-factory";


async function testEmbedding() {
  console.log('🧪 Testing embedding performance...\n');
  
  const embeddings = EmbeddingFactory.create(defaultConfig.embedding);
  
  // Test single embedding
  console.log('1️⃣ Testing single embedding...');
  const start1 = Date.now();
  const single = await embeddings.embedQuery('test query');
  const time1 = Date.now() - start1;
  console.log(`   ✅ Single embedding: ${time1}ms (${single.length} dimensions)\n`);
  
  // Test batch of 10
  console.log('2️⃣ Testing batch of 10...');
  const batch10 = Array(10).fill('test document content');
  const start2 = Date.now();
  await embeddings.embedDocuments(batch10);
  const time2 = Date.now() - start2;
  console.log(`   ✅ Batch of 10: ${time2}ms (${time2/10}ms per doc)\n`);
  
  // Test batch of 50
  console.log('3️⃣ Testing batch of 50...');
  const batch50 = Array(50).fill('test document content');
  const start3 = Date.now();
  await embeddings.embedDocuments(batch50);
  const time3 = Date.now() - start3;
  console.log(`   ✅ Batch of 50: ${time3}ms (${time3/50}ms per doc)\n`);
  
  // Test batch of 100
  console.log('4️⃣ Testing batch of 100...');
  const batch100 = Array(100).fill('test document content');
  const start4 = Date.now();
  try {
    await embeddings.embedDocuments(batch100);
    const time4 = Date.now() - start4;
    console.log(`   ✅ Batch of 100: ${time4}ms (${time4/100}ms per doc)\n`);
  } catch (error) {
    console.log(`   ❌ Batch of 100 FAILED: ${error}\n`);
  }
  
  // Estimate total time
  const docsPerSecond = 1000 / (time3 / 50);
  const totalDocs = 1246;
  const estimatedTime = Math.ceil(totalDocs / docsPerSecond);
  
  console.log('📊 Estimates for 1246 documents:');
  console.log(`   Speed: ~${docsPerSecond.toFixed(1)} docs/sec`);
  console.log(`   Total time: ~${estimatedTime} seconds (${Math.ceil(estimatedTime/60)} minutes)\n`);
}

if (import.meta.main) {
  testEmbedding().catch(console.error);
}