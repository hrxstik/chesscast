import { Injectable, NotFoundException } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { OrganizationRepository } from './organization.repository';
import { CreateOrganizationDto } from 'src/dtos/create/create-organization.dto';
import generateCode from 'utils/generate-code';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
  ) {}

  async findById(id: number): Promise<Organization> {
    const organization = await this.organizationRepository.findById(id);
    if (!organization) {
      throw new NotFoundException(`Organization with id ${id} not found`);
    }
    return organization;
  }

  async updateById(id: number, data: any): Promise<Organization> {
    const organization = await this.organizationRepository.findById(id);
    if (!organization) {
      throw new NotFoundException(`Organization with id ${id} not found`);
    }
    return this.organizationRepository.updateById(id, data);
  }

  async create(data: CreateOrganizationDto): Promise<Organization> {
    const createData = { ...data, inviteCode: generateCode(6) };
    return this.organizationRepository.create(createData);
  }

  async recreateInviteCode(id: number): Promise<Organization> {
    const organization = await this.organizationRepository.findById(id);
    if (!organization) {
      throw new NotFoundException(`Organization with id ${id} not found`);
    }
    return this.organizationRepository.updateById(id, {
      inviteCode: generateCode(6),
    });
  }
}
