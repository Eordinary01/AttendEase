/**
 * Universal Pagination Middleware & Helper
 * Standardizes page & limit calculation with bounded caps to eliminate massive unindexed memory dumps.
 */

function getPagination(req, defaultLimit = 50, maxLimit = 200) {
  const query = req?.query || req || {};
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const requestedLimit = parseInt(query.limit, 10) || defaultLimit;
  const limit = Math.min(maxLimit, Math.max(1, requestedLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function paginate(query, page = 1, limit = 50, maxLimit = 200) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (p - 1) * l;
  return query.skip(skip).limit(l);
}

function paginatedResponse(docs, total, page = 1, limit = 50, maxLimit = 200) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 50));
  const totalPages = Math.max(1, Math.ceil(total / l));
  return {
    success: true,
    data: docs,
    pagination: {
      page: p,
      limit: l,
      total,
      pages: totalPages,
      totalPages,
      hasNextPage: p < totalPages,
      hasPrevPage: p > 1,
      hasNext: p < totalPages,
      hasPrev: p > 1,
    },
  };
}

module.exports = { getPagination, paginate, paginatedResponse };
