function paginate(query, page = 1, limit = 50) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (p - 1) * l;
  return query.skip(skip).limit(l);
}

function paginatedResponse(docs, total, page = 1, limit = 50) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  return {
    success: true,
    data: docs,
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages: Math.ceil(total / l),
      hasNextPage: p * l < total,
      hasPrevPage: p > 1
    }
  };
}

module.exports = { paginate, paginatedResponse };
