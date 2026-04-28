# sync-conflict-audit-ledger-v2 Specification

## Purpose
Definir ledger consultable y append-only para conflictos y decisiones humanas del sync offline.

## Requirements

### Requirement: Conflict and resolution audit trail
The system MUST persist one immutable audit record for conflict detection and one for each manual resolution attempt, including `operationId`, actor, timestamp, reason, decision, and result.

#### Scenario: Registro obligatorio al resolver
- GIVEN un conflicto existente
- WHEN un usuario confirma `accept_server`
- THEN se guarda entrada de resolución con actor, timestamp, motivo y resultado

#### Scenario: Historial consultable por operación
- GIVEN una operación con múltiples intentos de resolución
- WHEN se consulta por `operationId`
- THEN el sistema retorna la secuencia cronológica completa
